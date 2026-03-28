import { useState, useEffect } from 'react';
import { socket } from '../socket';
import { GameState } from '../App';
import MiniCanvas from './MiniCanvas';
import TimerRing from './TimerRing';

interface Props {
  game: GameState;
  setGame: React.Dispatch<React.SetStateAction<GameState>>;
}

// Popular character suggestions by category
const CHARACTER_SUGGESTIONS = [
  // GTA / Games
  'Trevor Phillips', 'CJ (GTA San Andreas)', 'Niko Bellic', 'Tommy Vercetti',
  'Arthur Morgan', 'Master Chief', 'Kratos', 'Geralt of Rivia', 'Nathan Drake',
  'Lara Croft', 'Mario', 'Link', 'Sonic', 'Pikachu',
  // Movies / TV
  'Batman', 'Spider-Man', 'Iron Man', 'Joker', 'Thanos',
  'Jack Sparrow', 'Indiana Jones', 'John Wick', 'Walter White', 'The Mandalorian',
  'Darth Vader', 'Yoda', 'Sherlock Holmes', 'James Bond', 'Deadpool',
  // Anime
  'Naruto', 'Goku', 'Luffy', 'Eren Yeager', 'Levi Ackerman',
  'Itadori Yuji', 'Tanjiro', 'Zoro', 'Kakashi', 'Deku',
  // Pop culture
  'Elon Musk', 'Donald Trump', 'Cristiano Ronaldo', 'Lionel Messi',
  'Michael Jackson', 'Drake', 'Kanye West',
];

export default function GiverScreen({ game, setGame }: Props) {
  const [character, setCharacter] = useState('');
  const [hint, setHint] = useState('');
  const [characterSubmitted, setCharacterSubmitted] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const drawerName = game.roomState?.players.find(p => p.role === 'drawer')?.name || 'Drawer';

  useEffect(() => {
    setCharacter('');
    setHint('');
    setCharacterSubmitted(false);
    setSuggestions([]);
  }, [game.roomState?.currentRound]);

  // Filter suggestions as user types
  useEffect(() => {
    if (character.length < 1) { setSuggestions([]); return; }
    const q = character.toLowerCase();
    const matches = CHARACTER_SUGGESTIONS.filter(s => s.toLowerCase().includes(q)).slice(0, 5);
    setSuggestions(matches);
  }, [character]);

  const submitCharacter = () => {
    if (!character.trim()) return;
    socket.emit('submit_character', { character: character.trim() });
    setCharacterSubmitted(true);
    setSuggestions([]);
  };

  const submitHint = () => {
    if (!hint.trim()) return;
    socket.emit('submit_hint', { hint: hint.trim() });
    setHint('');
  };

  const nextHint = () => socket.emit('next_hint');

  const goToScoring = () => setGame(prev => ({ ...prev, phase: 'scoring' }));

  if (game.phase === 'viewing') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-bold text-center mb-2">Time to Score!</h2>
          <p className="text-gray-400 text-center mb-4 text-sm">Here's what {drawerName} drew:</p>
          <div className="rounded-2xl overflow-hidden border border-white/10 mb-6 bg-white" style={{ height: 280 }}>
            <MiniCanvas strokes={game.finalStrokes} />
          </div>
          <button onClick={goToScoring}
            className="w-full py-4 text-xl font-bold rounded-2xl bg-[#7B2FFF] hover:bg-[#9B5FFF] transition-all active:scale-95">
            Give Score →
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
          <p className="text-gray-500 text-xs uppercase tracking-widest">Round {(game.roomState?.currentRound || 0) + 1}</p>
          <h2 className="text-xl font-bold">You're the <span className="text-[#7B2FFF]">Giver</span></h2>
        </div>
        {game.phase === 'hint_round' && (
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs">Hint {game.hintIndex + 1}/{game.totalHints}</span>
            <TimerRing value={game.timerValue} max={game.timerMax} size={56} />
          </div>
        )}
      </div>

      {/* ── CHARACTER INPUT ─────────────────────────────────────────────── */}
      {game.phase === 'character_input' && !characterSubmitted && (
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
          <div className="mb-6 p-4 rounded-2xl bg-[#7B2FFF]/10 border border-[#7B2FFF]/30">
            <p className="text-[#7B2FFF] font-semibold text-sm mb-1">🔒 SECRET</p>
            <p className="text-gray-300 text-sm">{drawerName} won't see this until scoring!</p>
          </div>

          <label className="text-gray-400 text-sm mb-2 uppercase tracking-widest font-semibold">Character Name</label>

          <div className="relative mb-4">
            <input
              type="text"
              value={character}
              onChange={e => setCharacter(e.target.value)}
              placeholder="e.g. Naruto, Batman, Messi..."
              maxLength={50}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-lg focus:outline-none focus:border-[#7B2FFF] transition-colors"
              onKeyDown={e => e.key === 'Enter' && submitCharacter()}
              autoFocus
            />
            {/* Autocomplete dropdown */}
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-xl bg-[#1a1a2e] border border-white/10 overflow-hidden z-20 shadow-xl">
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => { setCharacter(s); setSuggestions([]); }}
                    className="w-full px-4 py-3 text-left text-white hover:bg-[#7B2FFF]/20 transition-colors text-sm border-b border-white/5 last:border-0">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick pick chips */}
          <p className="text-gray-500 text-xs mb-2 uppercase tracking-widest">Quick pick</p>
          <div className="flex flex-wrap gap-2 mb-6">
            {['Naruto', 'Batman', 'Messi', 'Goku', 'Jack Sparrow', 'Joker', 'Spider-Man', 'Walter White'].map(s => (
              <button key={s} onClick={() => setCharacter(s)}
                className="px-3 py-1.5 rounded-full bg-white/8 border border-white/15 text-gray-300 text-xs hover:border-[#7B2FFF] hover:text-[#7B2FFF] transition-all active:scale-95">
                {s}
              </button>
            ))}
          </div>

          <button onClick={submitCharacter} disabled={!character.trim()}
            className="w-full py-4 text-lg font-bold rounded-2xl bg-[#7B2FFF] hover:bg-[#9B5FFF] disabled:opacity-40 transition-all active:scale-95">
            Set Character →
          </button>
        </div>
      )}

      {/* ── ENTER FIRST HINT ────────────────────────────────────────────── */}
      {game.phase === 'character_input' && characterSubmitted && (
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
          <div className="text-center mb-6">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-green-400 font-semibold">Character set!</p>
            <p className="text-gray-400 text-sm mt-1">Now give {drawerName} their first hint</p>
          </div>
          <label className="text-gray-400 text-sm mb-2 uppercase tracking-widest font-semibold">Hint 1 of {game.totalHints}</label>
          <input type="text" value={hint} onChange={e => setHint(e.target.value)}
            placeholder="e.g. Wears an orange jumpsuit" maxLength={100} autoFocus
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-lg focus:outline-none focus:border-[#7B2FFF] transition-colors mb-4"
            onKeyDown={e => e.key === 'Enter' && submitHint()} />
          <button onClick={submitHint} disabled={!hint.trim()}
            className="w-full py-4 text-lg font-bold rounded-2xl bg-[#7B2FFF] hover:bg-[#9B5FFF] disabled:opacity-40 transition-all active:scale-95">
            Send Hint &amp; Start Timer ⏱️
          </button>
        </div>
      )}

      {/* ── WAITING FOR NEXT HINT ───────────────────────────────────────── */}
      {game.phase === 'waiting_hint' && (
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
          <div className="text-center mb-6">
            <p className="text-yellow-400 font-bold text-lg">⏱️ Timer ended!</p>
            <p className="text-gray-400 mt-1 text-sm">Enter hint {game.hintIndex + 1} of {game.totalHints}</p>
          </div>
          <label className="text-gray-400 text-sm mb-2 uppercase tracking-widest font-semibold">Hint {game.hintIndex + 1}</label>
          <input type="text" value={hint} onChange={e => setHint(e.target.value)}
            placeholder="Next hint..." maxLength={100} autoFocus
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-lg focus:outline-none focus:border-[#7B2FFF] transition-colors mb-4"
            onKeyDown={e => e.key === 'Enter' && submitHint()} />
          <button onClick={submitHint} disabled={!hint.trim()}
            className="w-full py-4 text-lg font-bold rounded-2xl bg-[#7B2FFF] hover:bg-[#9B5FFF] disabled:opacity-40 transition-all active:scale-95">
            Send Hint &amp; Start Timer ⏱️
          </button>
        </div>
      )}

      {/* ── ACTIVE HINT ROUND — watch live drawing ──────────────────────── */}
      {game.phase === 'hint_round' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="mb-3 p-3 rounded-xl bg-[#7B2FFF]/10 border border-[#7B2FFF]/30 flex-shrink-0">
            <p className="text-[#7B2FFF] text-xs font-semibold uppercase tracking-widest">Hint {game.hintIndex + 1}</p>
            <p className="text-white font-bold">{game.currentHint}</p>
          </div>

          {/* LIVE canvas — takes remaining space */}
          <div className="flex-1 rounded-2xl overflow-hidden border border-white/10 bg-white mb-3" style={{ minHeight: 160 }}>
            <MiniCanvas live={true} />
          </div>

          {/* Next hint / end button */}
          <div className="flex-shrink-0">
            <button onClick={nextHint}
              className="w-full py-3 font-bold rounded-2xl border-2 border-[#7B2FFF] text-[#7B2FFF] hover:bg-[#7B2FFF]/10 transition-all active:scale-95">
              {game.hintIndex + 1 < game.totalHints
                ? `Next Hint (${game.hintIndex + 2}/${game.totalHints}) →`
                : 'End Drawing →'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
