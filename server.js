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
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(express.static(path.join(__dirname, 'client', 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function createRoom(settings = {}) {
  return {
    players: [],
    phase: 'lobby',
    settings: {
      hintRounds: settings.hintRounds || 3,
      hintTimer: settings.hintTimer || 10
    },
    currentRound: 0,
    currentHintIndex: 0,   // which hint we are ON (0-based)
    character: null,
    hints: [],
    strokes: [],
    timerInterval: null,
    timerValue: 0,
    lastActivity: Date.now()
  };
}

function getRoom(roomId) { return rooms.get(roomId.toUpperCase()); }

function getRoomState(room, roomId) {
  return {
    roomId,
    players: room.players.map(p => ({ id: p.id, name: p.name, role: p.role })),
    phase: room.phase,
    settings: room.settings,
    currentRound: room.currentRound,
    currentHintIndex: room.currentHintIndex,
    hints: room.hints,
    timerValue: room.timerValue
  };
}

function stopTimer(room) {
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
}

function startTimer(roomId, duration, onEnd) {
  const room = getRoom(roomId);
  if (!room) return;
  stopTimer(room);
  room.timerValue = duration;
  io.to(roomId).emit('timer_tick', { value: room.timerValue, max: duration });
  room.timerInterval = setInterval(() => {
    const r = getRoom(roomId);
    if (!r) { clearInterval(room.timerInterval); return; }
    r.timerValue--;
    io.to(roomId).emit('timer_tick', { value: r.timerValue, max: duration });
    if (r.timerValue <= 0) {
      clearInterval(r.timerInterval);
      r.timerInterval = null;
      onEnd();
    }
  }, 1000);
}

// Called when timer ends OR giver clicks "Next Hint"
// This ENDS the current hint round and asks giver for the next hint (or ends game)
function endCurrentHintRound(roomId) {
  const room = getRoom(roomId);
  if (!room) return;
  if (room.phase !== 'hint_round') return;

  stopTimer(room);

  const nextIndex = room.currentHintIndex + 1;

  if (nextIndex >= room.settings.hintRounds) {
    // All hints done → game over, show drawing
    room.phase = 'viewing';
    io.to(roomId).emit('all_rounds_end', { strokes: room.strokes });
    io.to(roomId).emit('room_state', getRoomState(room, roomId));
    console.log(`Room ${roomId}: all hints done, viewing phase`);
  } else {
    // Move to next hint — lock drawer, ask giver for next hint
    room.currentHintIndex = nextIndex;
    room.phase = 'waiting_hint';   // drawer is locked, giver types next hint
    io.to(roomId).emit('waiting_for_hint', {
      hintIndex: nextIndex,
      totalHints: room.settings.hintRounds
    });
    io.to(roomId).emit('room_state', getRoomState(room, roomId));
    console.log(`Room ${roomId}: waiting for hint ${nextIndex + 1}`);
  }
}

// Cleanup old rooms
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.lastActivity > 2 * 60 * 60 * 1000) {
      stopTimer(room);
      rooms.delete(roomId);
    }
  }
}, 10 * 60 * 1000);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('create_room', ({ playerName, settings }) => {
    let roomId;
    do { roomId = generateRoomCode(); } while (rooms.has(roomId));
    const room = createRoom(settings);
    room.players.push({ id: socket.id, name: playerName, role: 'giver', isHost: true });
    rooms.set(roomId, room);
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.emit('room_created', { roomId, playerId: socket.id, role: 'giver', roomState: getRoomState(room, roomId) });
    console.log(`Room ${roomId} created by ${playerName}`);
  });

  socket.on('join_room', ({ roomId, playerName }) => {
    const id = roomId.toUpperCase();
    const room = getRoom(id);
    if (!room) { socket.emit('error', { message: 'Room not found. Check the code.' }); return; }
    if (room.players.length >= 2) { socket.emit('error', { message: 'Room is full.' }); return; }
    room.players.push({ id: socket.id, name: playerName, role: 'drawer', isHost: false });
    room.lastActivity = Date.now();
    socket.join(id);
    socket.data.roomId = id;
    socket.emit('room_joined', { roomId: id, playerId: socket.id, role: 'drawer', roomState: getRoomState(room, id) });
    socket.to(id).emit('player_joined', { player: { id: socket.id, name: playerName, role: 'drawer' }, roomState: getRoomState(room, id) });
    console.log(`${playerName} joined room ${id}`);
  });

  socket.on('update_settings', ({ hintRounds, hintTimer }) => {
    const roomId = socket.data.roomId;
    const room = getRoom(roomId);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player?.isHost) return;
    room.settings.hintRounds = hintRounds;
    room.settings.hintTimer = hintTimer;
    io.to(roomId).emit('settings_updated', { settings: room.settings });
  });

  socket.on('game_start', () => {
    const roomId = socket.data.roomId;
    const room = getRoom(roomId);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player?.isHost || room.players.length < 2) return;
    room.phase = 'character_input';
    room.currentHintIndex = 0;
    room.hints = [];
    room.strokes = [];
    room.character = null;
    room.lastActivity = Date.now();
    io.to(roomId).emit('game_start', { roomState: getRoomState(room, roomId) });
    console.log(`Game started in room ${roomId}`);
  });

  socket.on('submit_character', ({ character }) => {
    const roomId = socket.data.roomId;
    const room = getRoom(roomId);
    if (!room || room.phase !== 'character_input') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.role !== 'giver') return;
    room.character = character;
    room.lastActivity = Date.now();
    socket.emit('character_accepted');
    console.log(`Room ${roomId}: character set to "${character}"`);
  });

  // Giver submits a hint → starts timer, drawer can draw
  socket.on('submit_hint', ({ hint }) => {
    const roomId = socket.data.roomId;
    const room = getRoom(roomId);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.role !== 'giver') return;
    // Allow submitting hint from character_input or waiting_hint phases
    if (room.phase !== 'character_input' && room.phase !== 'waiting_hint') return;

    const hintIndex = room.currentHintIndex;
    room.hints[hintIndex] = hint;
    room.phase = 'hint_round';
    room.lastActivity = Date.now();

    // Tell both players: new hint, drawer can draw now
    io.to(roomId).emit('hint_received', {
      hint,
      hintIndex,
      totalHints: room.settings.hintRounds
    });
    io.to(roomId).emit('room_state', getRoomState(room, roomId));

    // Start countdown — when 0, lock drawer and ask for next hint (or end)
    startTimer(roomId, room.settings.hintTimer, () => endCurrentHintRound(roomId));
    console.log(`Room ${roomId}: hint ${hintIndex + 1}/${room.settings.hintRounds} = "${hint}"`);
  });

  // Giver manually clicks "Next Hint" or "End Drawing"
  socket.on('next_hint', () => {
    const roomId = socket.data.roomId;
    const room = getRoom(roomId);
    if (!room || room.phase !== 'hint_round') return;
    const giver = room.players.find(p => p.role === 'giver');
    if (giver?.id !== socket.id) return;
    endCurrentHintRound(roomId);
  });

  // Drawing strokes
  socket.on('drawing_stroke', (strokeData) => {
    const roomId = socket.data.roomId;
    const room = getRoom(roomId);
    if (!room) return;
    // Only allow drawing during hint_round
    if (room.phase !== 'hint_round') return;
    room.strokes.push(strokeData);
    if (room.strokes.length > 200) room.strokes.shift();
    room.lastActivity = Date.now();
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
    if (room.strokes.length > 0) room.strokes.pop();
    socket.to(roomId).emit('drawing_undo', strokeData);
  });

  socket.on('request_canvas_state', () => {
    const roomId = socket.data.roomId;
    const room = getRoom(roomId);
    if (!room) return;
    socket.emit('canvas_state', { strokes: room.strokes });
  });

  socket.on('submit_score', ({ score, comment }) => {
    const roomId = socket.data.roomId;
    const room = getRoom(roomId);
    if (!room) return;
    room.phase = 'reveal';
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
      p.isHost = p.role === 'giver';
    });
    room.phase = 'character_input';
    room.currentRound++;
    room.currentHintIndex = 0;
    room.hints = [];
    room.strokes = [];
    room.character = null;
    room.lastActivity = Date.now();
    io.to(roomId).emit('switch_roles', { roomState: getRoomState(room, roomId) });
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
    } else {
      stopTimer(room);
      room.phase = 'lobby';
      io.to(roomId).emit('player_left', { roomState: getRoomState(room, roomId) });
    }
    console.log(`Client disconnected from room ${roomId}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
