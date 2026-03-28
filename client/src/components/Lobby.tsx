import { useState, useEffect } from 'react';
import { socket } from '../socket';
import { GameState } from '../App';

interface Props {
  game: GameState;
  setGame: React.Dispatch<React.SetStateAction<GameState>>;
}

export default function Lobby({ game, setGame }: Props) {
  const [copied, setCopied] = useState(false);
  const [hintRounds, setHintRounds] = useState(game.roomState?.settings.hintRounds || 3);
  const [hintTimer, setHintTimer] = useState(game.roomState?.settings.hintTimer || 10);

  const isHost = game.roomState?.players.find(p => p.id === game.playerId)?.role === 'giver';
  const partnerJoined = (game.roomState?.players.length || 0) >= 2;
  const roomUrl = `${window.location.origin}/room/${game.roomId}`;

  useEffect(() => {
    if (game.roomState?.settings) {
      setHintRounds(game.roomState.settings.hintRounds);
      setHintTimer(game.roomState.settings.hintTimer);
    }
  }, [game.roomState?.settings]);

  // Update URL to show room code
  useEffect(() => {
    if (game.roomId) {
      window.history.pushState({}, '', `/room/${game.roomId}`);
    }
  }, [game.roomId]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = roomUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const updateSettings = (newRounds: number, newTimer: number) => {
    socket.emit('update_settings', { hintRounds: newRounds, hintTimer: newTimer });
  };

  const handleHintRoundsChange = (val: number) => {
    setHintRounds(val);
    updateSettings(val, hintTimer);
  };

  const handleHintTimerChange = (val: number) => {
    setHintTimer(val);
    updateSettings(hintRounds, val);
  };

  const startGame = () => {
    socket.emit('game_start');
  };

  const players = game.roomState?.players || [];

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-80 h-80 bg-purple-600 opacity-10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-1">Game Lobby</h2>
          <p className="text-gray-500">Room <span className="text-[#7B2FFF] font-bold text-xl tracking-widest">{game.roomId}</span></p>
        </div>

        {/* Share link */}
        <div className="mb-6 p-4 rounded-2xl bg-white/5 border border-white/10">
          <p className="text-gray-400 text-sm mb-3 uppercase tracking-widest font-semibold">Share with friend</p>
          <div className="flex gap-2">
            <div className="flex-1 px-3 py-2 rounded-xl bg-black/30 text-gray-300 text-sm truncate font-mono">
              {roomUrl}
            </div>
            <button
              onClick={copyLink}
              className="px-4 py-2 rounded-xl bg-[#7B2FFF] hover:bg-[#9B5FFF] text-sm font-bold transition-all active:scale-95 whitespace-nowrap"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Players */}
        <div className="mb-6 space-y-2">
          {players.map((player, i) => (
            <div
              key={player.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10"
            >
              <div className="w-8 h-8 rounded-full bg-[#7B2FFF] flex items-center justify-center text-sm font-bold">
                P{i + 1}
              </div>
              <span className="text-white font-semibold">{player.name}</span>
              {player.id === game.playerId && (
                <span className="ml-auto text-xs text-[#7B2FFF] font-semibold uppercase tracking-widest">You</span>
              )}
            </div>
          ))}
          {players.length < 2 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 border-dashed">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">
                P2
              </div>
              <span className="text-gray-500 italic">Waiting for player...</span>
              <div className="ml-auto flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>

        {/* Settings - only host can change */}
        <div className="mb-6 p-4 rounded-2xl bg-white/5 border border-white/10">
          <p className="text-gray-400 text-sm mb-4 uppercase tracking-widest font-semibold">Settings</p>

          <div className="mb-4">
            <p className="text-white text-sm mb-2 font-semibold">Hint Rounds</p>
            <div className="flex gap-2">
              {[1, 2, 3].map(n => (
                <button
                  key={n}
                  onClick={() => isHost && handleHintRoundsChange(n)}
                  disabled={!isHost}
                  className={`flex-1 py-2 rounded-xl font-bold transition-all ${
                    hintRounds === n
                      ? 'bg-[#7B2FFF] text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  } ${!isHost ? 'cursor-not-allowed' : 'active:scale-95'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-white text-sm mb-2 font-semibold">Timer per Hint</p>
            <div className="flex gap-2">
              {[10, 20, 30].map(n => (
                <button
                  key={n}
                  onClick={() => isHost && handleHintTimerChange(n)}
                  disabled={!isHost}
                  className={`flex-1 py-2 rounded-xl font-bold transition-all ${
                    hintTimer === n
                      ? 'bg-[#7B2FFF] text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  } ${!isHost ? 'cursor-not-allowed' : 'active:scale-95'}`}
                >
                  {n}s
                </button>
              ))}
            </div>
          </div>

          {!isHost && <p className="text-gray-500 text-xs mt-3 text-center">Only the host can change settings</p>}
        </div>

        {/* Status / Start */}
        {isHost ? (
          partnerJoined ? (
            <div className="space-y-3 animate-fade-in-up">
              <p className="text-center text-green-400 font-semibold">Partner joined! Ready to play.</p>
              <button
                onClick={startGame}
                className="w-full py-4 text-xl font-bold rounded-2xl bg-[#7B2FFF] hover:bg-[#9B5FFF] transition-all active:scale-95 shadow-lg shadow-purple-900/50"
              >
                Start Game
              </button>
            </div>
          ) : (
            <p className="text-center text-gray-500">Share the link above to invite your partner</p>
          )
        ) : (
          <p className="text-center text-gray-400">Waiting for host to start the game...</p>
        )}
      </div>
    </div>
  );
}
