import { useState, useEffect } from 'react';
import { socket } from './socket';
import Home from './components/Home';
import Lobby from './components/Lobby';
import GiverScreen from './components/GiverScreen';
import DrawerScreen from './components/DrawerScreen';
import ScoreScreen from './components/ScoreScreen';

export type GamePhase = 'home' | 'lobby' | 'character_input' | 'hint_round' | 'waiting_hint' | 'viewing' | 'scoring' | 'reveal';

export interface Player {
  id: string;
  name: string;
  role: 'giver' | 'drawer';
}

export interface RoomState {
  roomId: string;
  players: Player[];
  phase: string;
  settings: {
    hintRounds: number;
    hintTimer: number;
  };
  currentRound: number;
  currentHint: number;
  hints: string[];
  timerValue: number;
}

export interface GameState {
  roomId: string | null;
  playerId: string | null;
  playerName: string | null;
  role: 'giver' | 'drawer' | null;
  phase: GamePhase;
  roomState: RoomState | null;
  currentHint: string | null;
  hintIndex: number;
  totalHints: number;
  finalStrokes: any[];
  score: number | null;
  comment: string | null;
  character: string | null;
  timerValue: number;
  timerMax: number;
}

const initialState: GameState = {
  roomId: null,
  playerId: null,
  playerName: null,
  role: null,
  phase: 'home',
  roomState: null,
  currentHint: null,
  hintIndex: 0,
  totalHints: 3,
  finalStrokes: [],
  score: null,
  comment: null,
  character: null,
  timerValue: 0,
  timerMax: 10,
};

function App() {
  const [game, setGame] = useState<GameState>(initialState);

  useEffect(() => {
    socket.connect();

    socket.on('room_created', ({ roomId, playerId, role, roomState }) => {
      setGame(prev => ({
        ...prev,
        roomId,
        playerId,
        role,
        phase: 'lobby',
        roomState,
        totalHints: roomState.settings.hintRounds,
        timerMax: roomState.settings.hintTimer,
      }));
    });

    socket.on('room_joined', ({ roomId, playerId, role, roomState }) => {
      setGame(prev => ({
        ...prev,
        roomId,
        playerId,
        role,
        phase: 'lobby',
        roomState,
        totalHints: roomState.settings.hintRounds,
        timerMax: roomState.settings.hintTimer,
      }));
    });

    socket.on('player_joined', ({ player, roomState }) => {
      setGame(prev => ({
        ...prev,
        roomState,
        totalHints: roomState.settings.hintRounds,
        timerMax: roomState.settings.hintTimer,
      }));
    });

    socket.on('player_left', ({ roomState }) => {
      setGame(prev => ({ ...prev, roomState, phase: 'lobby' }));
    });

    socket.on('settings_updated', ({ settings }) => {
      setGame(prev => ({
        ...prev,
        totalHints: settings.hintRounds,
        timerMax: settings.hintTimer,
        roomState: prev.roomState ? { ...prev.roomState, settings } : prev.roomState,
      }));
    });

    socket.on('game_start', ({ roomState }) => {
      setGame(prev => ({
        ...prev,
        phase: 'character_input',
        roomState,
        currentHint: null,
        hintIndex: 0,
        finalStrokes: [],
        score: null,
        comment: null,
        character: null,
      }));
    });

    socket.on('character_accepted', () => {
      // Giver: waiting for hint submission phase (stays on character_input but character is set)
    });

    socket.on('hint_received', ({ hint, hintIndex, totalHints }) => {
      setGame(prev => ({
        ...prev,
        phase: 'hint_round',
        currentHint: hint,
        hintIndex,
        totalHints,
      }));
    });

    socket.on('timer_tick', ({ value, max }) => {
      setGame(prev => ({ ...prev, timerValue: value, timerMax: max }));
    });

    socket.on('round_end', ({ currentHint }) => {
      setGame(prev => ({ ...prev, hintIndex: currentHint }));
    });

    socket.on('waiting_for_hint', ({ hintIndex, totalHints }) => {
      setGame(prev => ({
        ...prev,
        phase: 'waiting_hint',
        hintIndex,
        totalHints,
      }));
    });

    socket.on('all_rounds_end', ({ strokes }) => {
      setGame(prev => ({
        ...prev,
        phase: 'viewing',
        finalStrokes: strokes,
      }));
    });

    socket.on('score_revealed', ({ score, comment, character, strokes }) => {
      setGame(prev => ({
        ...prev,
        phase: 'reveal',
        score,
        comment,
        character,
        finalStrokes: strokes,
      }));
    });

    socket.on('switch_roles', ({ roomState }) => {
      // Update role based on new room state
      setGame(prev => {
        const newRole = roomState.players.find((p: Player) => p.id === prev.playerId)?.role || prev.role;
        return {
          ...prev,
          phase: 'character_input',
          role: newRole,
          roomState,
          currentHint: null,
          hintIndex: 0,
          finalStrokes: [],
          score: null,
          comment: null,
          character: null,
        };
      });
    });

    socket.on('error', ({ message }) => {
      alert(message);
    });

    socket.on('room_state', ({ roomState }: { roomState: RoomState }) => {
      setGame(prev => ({
        ...prev,
        roomState,
      }));
    });

    return () => {
      socket.off('room_created');
      socket.off('room_joined');
      socket.off('player_joined');
      socket.off('player_left');
      socket.off('settings_updated');
      socket.off('game_start');
      socket.off('character_accepted');
      socket.off('hint_received');
      socket.off('waiting_for_hint');
      socket.off('timer_tick');
      socket.off('round_end');
      socket.off('all_rounds_end');
      socket.off('score_revealed');
      socket.off('switch_roles');
      socket.off('error');
      socket.off('room_state');
    };
  }, []);

  // Check URL for room code on load — auto-show join screen
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/\/room\/([A-Z0-9]{6})/i);
    if (match) {
      const code = match[1].toUpperCase();
      setGame(prev => ({ ...prev, phase: 'home', roomId: code }));
      // Clean up URL but keep code in state
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const renderScreen = () => {
    switch (game.phase) {
      case 'home':
        return <Home game={game} setGame={setGame} />;
      case 'lobby':
        return <Lobby game={game} setGame={setGame} />;
      case 'character_input':
      case 'hint_round':
      case 'waiting_hint':
      case 'viewing':
        if (game.role === 'giver') {
          return <GiverScreen game={game} setGame={setGame} />;
        } else {
          return <DrawerScreen game={game} setGame={setGame} />;
        }
      case 'scoring':
        return <ScoreScreen game={game} setGame={setGame} mode="scoring" />;
      case 'reveal':
        return <ScoreScreen game={game} setGame={setGame} mode="reveal" />;
      default:
        return <Home game={game} setGame={setGame} />;
    }
  };

  return (
    <div className="w-full h-full bg-[#0a0a0f] text-white font-rajdhani overflow-hidden">
      {renderScreen()}
    </div>
  );
}

export default App;
