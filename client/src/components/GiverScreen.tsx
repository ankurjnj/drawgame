import { useState, useEffect } from 'react';
import { socket } from '../socket';
import { GameState } from '../App';
import MiniCanvas from './MiniCanvas';
import TimerRing from './TimerRing';

interface Props {
  game: GameState;
  setGame: React.Dispatch<React.SetStateAction<GameState>>;
}

export default function GiverScreen({ game, setGame }: Props) {
  const [character, setCharacter] = useState('');
  const [hint, setHint] = useState('');
  const [characterSubmitted, setCharacterSubmitted] = useState(false);

  const drawerName = game.roomState?.players.find(p => p.role === 'drawer')?.name || 'Drawer';

  useEffect(() => {
    setCharacter('');
    setHint('');
    setCharacterSubmitted(false);
  }, [game.roomState?.currentRound]);

  const submitCharacter = () => {
    if (!character.trim()) return;
    socket.emit('submit_character', { character: character.trim() });
    setCharacterSubmitted(true);
  };

  const submitHint = () => {
    if (!hint.trim()) return;
    socket.emit('submit_hint', { hint: hint.trim() });
    setHint('');
  };

  const nextHint = () => {
    socket.emit('next_hint');
  };

  // Viewing phase: giver scores
  const goToScoring = () => {
    setGame(prev => ({ ...prev, phase: 'scoring' }));
  };

  if (game.phase === 'viewing') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-bold text-center mb-4">Time to Score!</h2>
          <p className="text-gray-400 text-center mb-6">All hints used. Here's what {drawerName} drew:</p>
          <div className="rounded-2xl overflow-hidden border border-white/10 mb-6 bg-white">
            <MiniCanvas strokes={game.finalStrokes} width={400} height={300} />
          </div>
          <button
            onClick={goToScoring}
            className="w-full py-4 text-xl font-bold rounded-2xl bg-[#7B2FFF] hover:bg-[#9B5FFF] transition-all active:scale-95"
          >
            Give Score
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col p-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-gray-500 text-sm uppercase tracking-widest">Round {(game.roomState?.currentRound || 0) + 1}</p>
          <h2 className="text-xl font-bold">You're the <span className="text-[#7B2FFF]">Giver</span></h2>
        </div>
        {game.phase === 'hint_round' && (
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm">Hint {game.hintIndex + 1}/{game.totalHints}</span>
            <TimerRing value={game.timerValue} max={game.timerMax} size={64} />
          </div>
        )}
      </div>

      {/* Character input phase */}
      {game.phase === 'character_input' && !characterSubmitted && (
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
          <div className="mb-8 p-4 rounded-2xl bg-[#7B2FFF]/10 border border-[#7B2FFF]/30">
            <p className="text-[#7B2FFF] font-semibold text-sm mb-1">SECRET</p>
            <p className="text-gray-300 text-sm">Enter the character {drawerName} will draw. They won't see this!</p>
          </div>
          <label className="text-gray-400 text-sm mb-2 uppercase tracking-widest font-semibold">Character Name</label>
          <input
            type="text"
            value={character}
            onChange={e => setCharacter(e.target.value)}
            placeholder="e.g. Sherlock Holmes"
            maxLength={50}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-lg focus:outline-none focus:border-[#7B2FFF] transition-colors mb-4"
            onKeyDown={e => e.key === 'Enter' && submitCharacter()}
            autoFocus
          />
          <button
            onClick={submitCharacter}
            disabled={!character.trim()}
            className="w-full py-4 text-lg font-bold rounded-2xl bg-[#7B2FFF] hover:bg-[#9B5FFF] disabled:opacity-40 transition-all active:scale-95"
          >
            Submit Character
          </button>
        </div>
      )}

      {/* After character submitted - waiting or hint entry */}
      {game.phase === 'character_input' && characterSubmitted && (
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
          <div className="text-center mb-8">
            <div className="text-4xl mb-3">✓</div>
            <p className="text-green-400 font-semibold text-lg">Character set!</p>
            <p className="text-gray-400 mt-2">Now enter your first hint for {drawerName}</p>
          </div>
          <label className="text-gray-400 text-sm mb-2 uppercase tracking-widest font-semibold">Hint 1</label>
          <input
            type="text"
            value={hint}
            onChange={e => setHint(e.target.value)}
            placeholder="e.g. Wears a deerstalker hat"
            maxLength={100}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-lg focus:outline-none focus:border-[#7B2FFF] transition-colors mb-4"
            onKeyDown={e => e.key === 'Enter' && submitHint()}
            autoFocus
          />
          <button
            onClick={submitHint}
            disabled={!hint.trim()}
            className="w-full py-4 text-lg font-bold rounded-2xl bg-[#7B2FFF] hover:bg-[#9B5FFF] disabled:opacity-40 transition-all active:scale-95"
          >
            Send Hint &amp; Start Timer
          </button>
        </div>
      )}

      {/* Active hint round - watch drawing */}
      {game.phase === 'hint_round' && (
        <div className="flex-1 flex flex-col">
          <div className="mb-3 p-3 rounded-xl bg-[#7B2FFF]/10 border border-[#7B2FFF]/30">
            <p className="text-[#7B2FFF] text-sm font-semibold">Current Hint {game.hintIndex + 1}</p>
            <p className="text-white text-lg font-bold">{game.currentHint}</p>
          </div>

          {/* Live canvas preview */}
          <div className="flex-1 rounded-2xl overflow-hidden border border-white/10 bg-white mb-4" style={{ minHeight: 200 }}>
            <MiniCanvas strokes={[]} live={true} width={400} height={300} />
          </div>

          <div className="flex gap-3">
            {game.hintIndex + 1 < game.totalHints ? (
              <button
                onClick={nextHint}
                className="flex-1 py-3 font-bold rounded-2xl border-2 border-[#7B2FFF] text-[#7B2FFF] hover:bg-[#7B2FFF]/10 transition-all active:scale-95"
              >
                Next Hint ({game.hintIndex + 2}/{game.totalHints})
              </button>
            ) : (
              <button
                onClick={nextHint}
                className="flex-1 py-3 font-bold rounded-2xl border-2 border-[#7B2FFF] text-[#7B2FFF] hover:bg-[#7B2FFF]/10 transition-all active:scale-95"
              >
                End Drawing
              </button>
            )}
          </div>

          {/* Hint entry for next hints */}
          {game.hintIndex + 1 < game.totalHints && (
            <div className="mt-4">
              <label className="text-gray-400 text-sm mb-2 block uppercase tracking-widest font-semibold">
                Prepare Hint {game.hintIndex + 2}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={hint}
                  onChange={e => setHint(e.target.value)}
                  placeholder="Next hint..."
                  maxLength={100}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[#7B2FFF] transition-colors"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
