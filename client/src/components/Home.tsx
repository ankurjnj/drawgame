import { useState, useEffect } from 'react';
import { socket } from '../socket';
import { GameState } from '../App';

interface Props {
  game: GameState;
  setGame: React.Dispatch<React.SetStateAction<GameState>>;
}

export default function Home({ game, setGame }: Props) {
  const [playerName, setPlayerName] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [error, setError] = useState('');

  // If roomId pre-filled from URL, go straight to join mode
  const [mode, setMode] = useState<'select' | 'create' | 'join'>(
    game.roomId ? 'join' : 'select'
  );

  // Pre-fill room code from URL
  useEffect(() => {
    if (game.roomId) {
      setRoomCodeInput(game.roomId);
      setMode('join');
    }
  }, [game.roomId]);

  const handleCreate = () => {
    if (!playerName.trim()) { setError('Enter your name first'); return; }
    setError('');
    setGame(prev => ({ ...prev, playerName: playerName.trim() }));
    socket.emit('create_room', { playerName: playerName.trim(), settings: {} });
  };

  const handleJoin = () => {
    if (!playerName.trim()) { setError('Enter your name first'); return; }
    const code = roomCodeInput.trim().toUpperCase();
    if (code.length !== 6) { setError('Room code must be 6 characters'); return; }
    setError('');
    setGame(prev => ({ ...prev, playerName: playerName.trim() }));
    socket.emit('join_room', { roomId: code, playerName: playerName.trim() });
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-600 opacity-10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-6xl font-bold tracking-wider text-white mb-2" style={{ fontFamily: 'Rajdhani' }}>
            DRAW<span className="text-[#7B2FFF]">GAME</span>
          </h1>
          <p className="text-gray-400 text-sm">Real-time drawing game for two</p>
        </div>

        {/* SELECT MODE */}
        {mode === 'select' && (
          <div className="space-y-4">
            <button
              onClick={() => setMode('create')}
              className="w-full py-4 text-xl font-bold rounded-2xl bg-[#7B2FFF] hover:bg-[#9B5FFF] transition-all active:scale-95 shadow-lg shadow-purple-900/50"
            >
              🎮 Create Game
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full py-4 text-xl font-bold rounded-2xl border-2 border-[#7B2FFF] text-[#7B2FFF] hover:bg-[#7B2FFF]/10 transition-all active:scale-95"
            >
              🔗 Join Game
            </button>
          </div>
        )}

        {/* CREATE MODE */}
        {mode === 'create' && (
          <div className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm font-semibold mb-2 uppercase tracking-widest">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={e => { setPlayerName(e.target.value); setError(''); }}
                placeholder="Enter your name"
                maxLength={20}
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-lg focus:outline-none focus:border-[#7B2FFF] transition-colors"
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </div>
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              onClick={handleCreate}
              className="w-full py-4 text-xl font-bold rounded-2xl bg-[#7B2FFF] hover:bg-[#9B5FFF] transition-all active:scale-95 shadow-lg shadow-purple-900/50"
            >
              Create Game →
            </button>
            <button onClick={() => { setMode('select'); setError(''); }} className="w-full py-3 text-gray-500 hover:text-white transition-colors text-sm">
              ← Back
            </button>
          </div>
        )}

        {/* JOIN MODE */}
        {mode === 'join' && (
          <div className="space-y-4">
            {game.roomId && (
              <div className="bg-[#7B2FFF]/20 border border-[#7B2FFF]/40 rounded-xl p-3 text-center">
                <p className="text-purple-300 text-sm">You were invited to join room</p>
                <p className="text-white text-2xl font-bold tracking-widest mt-1">{game.roomId}</p>
              </div>
            )}
            <div>
              <label className="block text-gray-400 text-sm font-semibold mb-2 uppercase tracking-widest">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={e => { setPlayerName(e.target.value); setError(''); }}
                placeholder="Enter your name"
                maxLength={20}
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-lg focus:outline-none focus:border-[#7B2FFF] transition-colors"
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm font-semibold mb-2 uppercase tracking-widest">Room Code</label>
              <input
                type="text"
                value={roomCodeInput}
                onChange={e => { setRoomCodeInput(e.target.value.toUpperCase()); setError(''); }}
                placeholder="ABC123"
                maxLength={6}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-2xl font-bold tracking-widest text-center focus:outline-none focus:border-[#7B2FFF] transition-colors"
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
              />
            </div>
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              onClick={handleJoin}
              className="w-full py-4 text-xl font-bold rounded-2xl bg-[#7B2FFF] hover:bg-[#9B5FFF] transition-all active:scale-95 shadow-lg shadow-purple-900/50"
            >
              Join Game →
            </button>
            <button onClick={() => { setMode('select'); setError(''); setGame(p => ({...p, roomId: null})); }} className="w-full py-3 text-gray-500 hover:text-white transition-colors text-sm">
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
