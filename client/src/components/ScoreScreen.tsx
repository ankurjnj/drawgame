import { useState, useEffect } from 'react';
import { socket } from '../socket';
import { GameState } from '../App';
import MiniCanvas from './MiniCanvas';

interface Props {
  game: GameState;
  setGame: React.Dispatch<React.SetStateAction<GameState>>;
  mode: 'scoring' | 'reveal';
}

export default function ScoreScreen({ game, setGame, mode }: Props) {
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState('');
  const [displayScore, setDisplayScore] = useState(0);

  const isGiver = game.role === 'giver';

  // Animate score on reveal
  useEffect(() => {
    if (mode === 'reveal' && game.score !== null) {
      let current = 0;
      const target = game.score;
      const step = target / 20;
      const interval = setInterval(() => {
        current += step;
        if (current >= target) {
          current = target;
          clearInterval(interval);
        }
        setDisplayScore(Math.round(current));
      }, 50);
      return () => clearInterval(interval);
    }
  }, [mode, game.score]);

  const submitScore = () => {
    socket.emit('submit_score', { score, comment: comment.trim() || 'No comment.' });
  };

  const switchRoles = () => {
    socket.emit('switch_roles');
  };

  // Scoring screen (only giver sees this)
  if (mode === 'scoring' && isGiver) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-md">
          <h2 className="text-3xl font-bold text-center mb-2">Score the Drawing</h2>
          <p className="text-gray-400 text-center mb-6">How well did they capture the character?</p>

          {/* Final drawing */}
          <div className="rounded-2xl overflow-hidden border border-white/10 mb-6 bg-white">
            <MiniCanvas strokes={game.finalStrokes} width={400} height={300} />
          </div>

          {/* Score slider */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-400 font-semibold">Score</span>
              <span className="text-5xl font-bold text-[#7B2FFF]">{score}</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={score}
              onChange={e => setScore(Number(e.target.value))}
              className="w-full h-3 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #7B2FFF ${(score - 1) * 11.11}%, rgba(255,255,255,0.1) ${(score - 1) * 11.11}%)`
              }}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1 - Stick figure</span>
              <span>10 - Masterpiece</span>
            </div>
          </div>

          {/* Score quick-tap */}
          <div className="flex gap-2 mb-6">
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <button
                key={n}
                onClick={() => setScore(n)}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all active:scale-90 ${
                  score === n ? 'bg-[#7B2FFF] text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          {/* Comment */}
          <div className="mb-6">
            <label className="block text-gray-400 text-sm mb-2 uppercase tracking-widest font-semibold">
              Art Teacher Comment
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Needs more shading... The proportions are off... Surprisingly decent!"
              maxLength={200}
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[#7B2FFF] resize-none transition-colors"
            />
          </div>

          <button
            onClick={submitScore}
            className="w-full py-4 text-xl font-bold rounded-2xl bg-[#7B2FFF] hover:bg-[#9B5FFF] transition-all active:scale-95 shadow-lg shadow-purple-900/50"
          >
            Reveal Score
          </button>
        </div>
      </div>
    );
  }

  // Waiting screen for drawer while giver is scoring
  if (mode === 'scoring' && !isGiver) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6">
        <div className="text-center">
          <div className="text-6xl mb-6">🎨</div>
          <h2 className="text-2xl font-bold mb-3">Drawing submitted!</h2>
          <p className="text-gray-400">
            {game.roomState?.players.find(p => p.role === 'giver')?.name || 'Your partner'} is judging your work...
          </p>
          <div className="flex justify-center gap-2 mt-6">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-3 h-3 rounded-full bg-[#7B2FFF]"
                style={{ animation: `bounce 1s infinite ${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Reveal screen - both players see this
  if (mode === 'reveal') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-md animate-fade-in-up">
          {/* Character name */}
          <div className="text-center mb-4">
            <p className="text-gray-400 text-sm uppercase tracking-widest mb-1">The character was</p>
            <h2 className="text-4xl font-bold text-[#7B2FFF]">{game.character}</h2>
          </div>

          {/* Drawing */}
          <div className="rounded-2xl overflow-hidden border border-white/10 mb-6 bg-white shadow-2xl">
            <MiniCanvas strokes={game.finalStrokes} width={400} height={300} />
          </div>

          {/* Score reveal */}
          <div className="text-center mb-6 animate-score-reveal">
            <p className="text-gray-400 text-sm uppercase tracking-widest mb-2">Score</p>
            <div className="relative inline-block">
              <span
                className="text-9xl font-black"
                style={{
                  background: 'linear-gradient(135deg, #7B2FFF, #ec4899)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                {displayScore}
              </span>
              <span className="text-gray-400 text-2xl ml-2">/10</span>
            </div>
          </div>

          {/* Art teacher comment */}
          {game.comment && (
            <div className="mb-8 p-5 rounded-2xl bg-white/5 border border-white/10 relative">
              <div className="absolute -top-3 left-4 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                Art Teacher
              </div>
              <p
                className="text-red-300 text-2xl leading-relaxed"
                style={{ fontFamily: 'Caveat', color: '#ff6b6b' }}
              >
                "{game.comment}"
              </p>
            </div>
          )}

          {/* Actions */}
          <button
            onClick={switchRoles}
            className="w-full py-4 text-xl font-bold rounded-2xl bg-[#7B2FFF] hover:bg-[#9B5FFF] transition-all active:scale-95 shadow-lg shadow-purple-900/50"
          >
            Switch Roles
          </button>
        </div>
      </div>
    );
  }

  return null;
}
