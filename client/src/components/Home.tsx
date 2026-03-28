import { useState } from 'react';
import { socket } from '../socket';
import { GameState } from '../App';

interface Props {
  game: GameState;
  setGame: React.Dispatch<React.SetStateAction<GameState>>;
}

export default function Home({ game, setGame }: Props) {
  const [playerName, setPlayerName] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState(game.roomId || '');
  const [mode, setMode] = useState<'select' | 'create' | 'join'>(
    game.roomId ? 'join' : 'select'
  );

  const handleCreate = () => {
    if (!playerName.trim()) return;
    setGame(prev => ({ ...prev, playerName: playerName.trim() }));
    socket.emit('create_room', { playerName: playerName.trim(), settings: {} });
    // Update URL when created
    window.history.pushState({}, '', '/');
  };

  const handleJoin = () => {
    if (!playerName.trim() || !roomCodeInput.trim()) return;
    const code = roomCodeInput.trim().toUpperCase();
    setGame(prev => ({ ...prev, playerName: playerName.trim() }));
    socket.emit('join_room', { roomId: code, playerName: playerName.trim() });
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-600 opacity-10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold tracking-wider text-white mb-2" style={{ fontFamily: 'Rajdhani' }}>
            DRAW<span className="text-[#7B2FFF]">GAME</span>
          </h1>
          <p className="text-gray-400 text-lg">The real-time drawing game</p>
        </div>

        {mode === 'select' && (
          <div className="space-y-4 animate-fade-in-up">
            <button
              onClick={() => setMode('create')}
              className="w-full py-4 text-xl font-bold rounded-2xl bg-[#7B2FFF] hover:bg-[#9B5FFF] transition-all active:scale-95 shadow-lg shadow-purple-900/50"
            >
              Create Game
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full py-4 text-xl font-bold rounded-2xl border-2 border-[#7B2FFF] text-[#7B2FFF] hover:bg-[#7B2FFF]/10 transition-all active:scale-95"
            >
              Join Game
            </button>
          </div>
        )}

        {(mode === 'create' || mode === 'join') && (
          <div className="space-y-4 animate-fade-in-up">
            <div>
              <label className="block text-gray-400 text-sm font-semibold mb-2 uppercase tracking-widest">
                Your Name
              </label>
              <input
                type="text"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                maxLength={20}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-lg focus:outline-none focus:border-[#7B2FFF] transition-colors"
                onKeyDown={e => e.key === 'Enter' && (mode === 'create' ? handleCreate() : handleJoin())}
                autoFocus
              />
            </div>

            {mode === 'join' && (
              <div>
                <label className="block text-gray-400 text-sm font-semibold mb-2 uppercase tracking-widest">
                  Room Code
                </label>
                <input
                  type="text"
                  value={roomCodeInput}
                  onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  maxLength={6}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-2xl font-bold tracking-widest text-center focus:outline-none focus:border-[#7B2FFF] transition-colors"
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                />
              </div>
            )}

            <button
              onClick={mode === 'create' ? handleCreate : handleJoin}
              disabled={!playerName.trim() || (mode === 'join' && !roomCodeInput.trim())}
              className="w-full py-4 text-xl font-bold rounded-2xl bg-[#7B2FFF] hover:bg-[#9B5FFF] disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg shadow-purple-900/50"
            >
              {mode === 'create' ? 'Create Game' : 'Join Game'}
            </button>

            <button
              onClick={() => { setMode('select'); setRoomCodeInput(''); }}
              className="w-full py-3 text-gray-400 hover:text-white transition-colors"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
