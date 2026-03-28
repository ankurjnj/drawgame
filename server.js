const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Serve built frontend
app.use(express.static(path.join(__dirname, 'client', 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

// Game state
const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function createRoom(settings = {}) {
  return {
    players: [],
    phase: 'lobby', // lobby, character_input, hint_round, viewing, scoring, reveal
    settings: {
      hintRounds: settings.hintRounds || 3,
      hintTimer: settings.hintTimer || 10
    },
    currentRound: 0, // 0 = P1 gives, 1 = P2 gives
    currentHint: 0,
    character: null,
    hints: [],
    strokes: [], // last 50 strokes
    timerInterval: null,
    timerValue: 0,
    lastActivity: Date.now()
  };
}

function getRoom(roomId) {
  return rooms.get(roomId.toUpperCase());
}

function getRoomState(room, roomId) {
  return {
    roomId,
    players: room.players.map(p => ({ id: p.id, name: p.name, role: p.role })),
    phase: room.phase,
    settings: room.settings,
    currentRound: room.currentRound,
    currentHint: room.currentHint,
    hints: room.hints,
    timerValue: room.timerValue
  };
}

function startTimer(roomId, duration, onEnd) {
  const room = getRoom(roomId);
  if (!room) return;

  if (room.timerInterval) {
    clearInterval(room.timerInterval);
  }

  room.timerValue = duration;
  io.to(roomId).emit('timer_tick', { value: room.timerValue, max: duration });

  room.timerInterval = setInterval(() => {
    const r = getRoom(roomId);
    if (!r) {
      clearInterval(room.timerInterval);
      return;
    }
    r.timerValue--;
    io.to(roomId).emit('timer_tick', { value: r.timerValue, max: duration });

    if (r.timerValue <= 0) {
      clearInterval(r.timerInterval);
      r.timerInterval = null;
      onEnd();
    }
  }, 1000);
}

function stopTimer(room) {
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
}

function advanceHint(roomId) {
  const room = getRoom(roomId);
  if (!room) return;

  room.currentHint++;

  if (room.currentHint >= room.settings.hintRounds) {
    // All hints used
    stopTimer(room);
    room.phase = 'viewing';
    io.to(roomId).emit('all_rounds_end', {
      strokes: room.strokes
    });
    io.to(roomId).emit('room_state', getRoomState(room, roomId));
  } else {
    // Next hint round
    room.phase = 'hint_round';
    io.to(roomId).emit('round_end', { currentHint: room.currentHint });

    // Wait for giver to submit next hint or show existing
    const existingHint = room.hints[room.currentHint];
    if (existingHint) {
      io.to(roomId).emit('hint_received', {
        hint: existingHint,
        hintIndex: room.currentHint,
        totalHints: room.settings.hintRounds
      });
      startTimer(roomId, room.settings.hintTimer, () => advanceHint(roomId));
    }
    io.to(roomId).emit('room_state', getRoomState(room, roomId));
  }
}

// Cleanup old rooms every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.lastActivity > 2 * 60 * 60 * 1000) {
      stopTimer(room);
      rooms.delete(roomId);
      console.log(`Cleaned up room ${roomId}`);
    }
  }
}, 10 * 60 * 1000);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('create_room', ({ playerName, settings }) => {
    let roomId;
    do {
      roomId = generateRoomCode();
    } while (rooms.has(roomId));

    const room = createRoom(settings);
    const player = {
      id: socket.id,
      name: playerName,
      role: 'giver', // P1 starts as giver
      isHost: true
    };
    room.players.push(player);
    rooms.set(roomId, room);

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.playerName = playerName;

    socket.emit('room_created', {
      roomId,
      playerId: socket.id,
      role: 'giver',
      roomState: getRoomState(room, roomId)
    });

    console.log(`Room ${roomId} created by ${playerName}`);
  });

  socket.on('join_room', ({ roomId, playerName }) => {
    const upperRoomId = roomId.toUpperCase();
    const room = getRoom(upperRoomId);

    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (room.players.length >= 2) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }

    const player = {
      id: socket.id,
      name: playerName,
      role: 'drawer', // P2 starts as drawer
      isHost: false
    };
    room.players.push(player);
    room.lastActivity = Date.now();

    socket.join(upperRoomId);
    socket.data.roomId = upperRoomId;
    socket.data.playerName = playerName;

    socket.emit('room_joined', {
      roomId: upperRoomId,
      playerId: socket.id,
      role: 'drawer',
      roomState: getRoomState(room, upperRoomId)
    });

    // Notify P1
    socket.to(upperRoomId).emit('player_joined', {
      player: { id: player.id, name: player.name, role: player.role },
      roomState: getRoomState(room, upperRoomId)
    });

    console.log(`${playerName} joined room ${upperRoomId}`);
  });

  socket.on('update_settings', ({ hintRounds, hintTimer }) => {
    const roomId = socket.data.roomId;
    const room = getRoom(roomId);
    if (!room) return;

    // Only host can update settings
    const player = room.players.find(p => p.id === socket.id);
    if (!player?.isHost) return;

    room.settings.hintRounds = hintRounds;
    room.settings.hintTimer = hintTimer;
    room.lastActivity = Date.now();

    io.to(roomId).emit('settings_updated', { settings: room.settings });
  });

  socket.on('game_start', () => {
    const roomId = socket.data.roomId;
    const room = getRoom(roomId);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player?.isHost) return;
    if (room.players.length < 2) return;

    room.phase = 'character_input';
    room.currentHint = 0;
    room.hints = [];
    room.strokes = [];
    room.character = null;
    room.lastActivity = Date.now();

    io.to(roomId).emit('game_start', {
      roomState: getRoomState(room, roomId)
    });

    console.log(`Game started in room ${roomId}`);
  });

  socket.on('submit_character', ({ character }) => {
    const roomId = socket.data.roomId;
    const room = getRoom(roomId);
    if (!room || room.phase !== 'character_input') return;

    room.character = character;
    room.lastActivity = Date.now();

    // Only tell the giver that character was accepted
    socket.emit('character_accepted');
  });

  socket.on('submit_hint', ({ hint }) => {
    const roomId = socket.data.roomId;
    const room = getRoom(roomId);
    if (!room) return;

    const hintIndex = room.hints.length;
    room.hints.push(hint);
    room.phase = 'hint_round';
    room.lastActivity = Date.now();

    // Send hint to drawer
    io.to(roomId).emit('hint_received', {
      hint,
      hintIndex,
      totalHints: room.settings.hintRounds
    });

    io.to(roomId).emit('room_state', getRoomState(room, roomId));

    // Start timer
    startTimer(roomId, room.settings.hintTimer, () => advanceHint(roomId));
  });

  socket.on('next_hint', () => {
    const roomId = socket.data.roomId;
    const room = getRoom(roomId);
    if (!room || room.phase !== 'hint_round') return;

    // Only giver can advance
    const giver = room.players.find(p => p.role === 'giver');
    if (giver?.id !== socket.id) return;

    stopTimer(room);
    advanceHint(roomId);
  });

  socket.on('drawing_stroke', (strokeData) => {
    const roomId = socket.data.roomId;
    const room = getRoom(roomId);
    if (!room) return;

    // Store stroke (keep last 50)
    room.strokes.push(strokeData);
    if (room.strokes.length > 50) {
      room.strokes.shift();
    }
    room.lastActivity = Date.now();

    // Broadcast to other players in room
    socket.to(roomId).emit('drawing_stroke', strokeData);
  });

  socket.on('drawing_clear', () => {
    const roomId = socket.data.roomId;
    const room = getRoom(roomId);
    if (!room) return;

    room.strokes = [];
    socket.to(roomId).emit('drawing_clear');
  });

  socket.on('drawing_undo', (strokeData) => {
    const roomId = socket.data.roomId;
    const room = getRoom(roomId);
    if (!room) return;

    // Remove last stroke
    if (room.strokes.length > 0) {
      room.strokes.pop();
    }

    socket.to(roomId).emit('drawing_undo', strokeData);
  });

  socket.on('submit_score', ({ score, comment }) => {
    const roomId = socket.data.roomId;
    const room = getRoom(roomId);
    if (!room) return;

    room.lastActivity = Date.now();

    io.to(roomId).emit('score_revealed', {
      score,
      comment,
      character: room.character,
      strokes: room.strokes
    });
  });

  socket.on('switch_roles', () => {
    const roomId = socket.data.roomId;
    const room = getRoom(roomId);
    if (!room) return;

    // Flip roles
    room.players.forEach(p => {
      p.role = p.role === 'giver' ? 'drawer' : 'giver';
      // Also flip host (for next round control)
    });

    room.phase = 'character_input';
    room.currentHint = 0;
    room.hints = [];
    room.strokes = [];
    room.character = null;
    room.currentRound++;
    room.lastActivity = Date.now();

    io.to(roomId).emit('switch_roles', {
      roomState: getRoomState(room, roomId)
    });

    console.log(`Roles switched in room ${roomId}`);
  });

  socket.on('request_canvas_state', () => {
    const roomId = socket.data.roomId;
    const room = getRoom(roomId);
    if (!room) return;

    socket.emit('canvas_state', { strokes: room.strokes });
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = getRoom(roomId);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== socket.id);

    if (room.players.length === 0) {
      stopTimer(room);
      rooms.delete(roomId);
      console.log(`Room ${roomId} deleted (empty)`);
    } else {
      io.to(roomId).emit('player_left', {
        playerId: socket.id,
        roomState: getRoomState(room, roomId)
      });
    }

    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
