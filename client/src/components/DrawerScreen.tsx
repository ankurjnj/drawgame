import { useState, useEffect, useRef } from 'react';
import { useCanvas } from '../hooks/useCanvas';
import { GameState } from '../App';
import TimerRing from './TimerRing';

interface Props {
  game: GameState;
  setGame: React.Dispatch<React.SetStateAction<GameState>>;
}

const COLORS = [
  '#000000', '#ffffff', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#78716c', '#84cc16', '#f43f5e', '#14b8a6'
];

const BRUSH_SIZES = [
  { label: 'S', size: 3 },
  { label: 'M', size: 8 },
  { label: 'L', size: 18 },
];

export default function DrawerScreen({ game }: Props) {
  const [color, setColor] = useState('#000000');
  const [brushSizeIdx, setBrushSizeIdx] = useState(1);
  const [isEraser, setIsEraser] = useState(false);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  const { canvasRef, clear, undo } = useCanvas({
    color,
    brushSize: BRUSH_SIZES[brushSizeIdx].size,
    isEraser
  });

  const giverName = game.roomState?.players.find(p => p.role === 'giver')?.name || 'Giver';

  // Compute canvas size to fill available space
  useEffect(() => {
    const measure = () => {
      if (canvasWrapRef.current) {
        const rect = canvasWrapRef.current.getBoundingClientRect();
        // Keep 4:3 ratio
        const w = rect.width;
        const h = rect.height;
        const ratio = 4 / 3;
        let cw = w;
        let ch = w / ratio;
        if (ch > h) {
          ch = h;
          cw = h * ratio;
        }
        setCanvasSize({ width: Math.floor(cw), height: Math.floor(ch) });
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const selectColor = (c: string) => {
    setColor(c);
    setIsEraser(false);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#0a0a0f] overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#111118] border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest">Drawing for {giverName}</p>
            {game.phase === 'hint_round' && game.currentHint && (
              <p className="text-[#7B2FFF] font-bold text-base leading-tight">{game.currentHint}</p>
            )}
            {game.phase === 'character_input' && (
              <p className="text-gray-400 text-sm italic">Waiting for hint...</p>
            )}
          </div>
        </div>
        {game.phase === 'hint_round' && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-xs">{game.hintIndex + 1}/{game.totalHints}</span>
            <TimerRing value={game.timerValue} max={game.timerMax} size={52} />
          </div>
        )}
      </div>

      {/* Canvas area */}
      <div ref={canvasWrapRef} className="flex-1 flex items-center justify-center bg-gray-900 overflow-hidden">
        <div
          className="relative shadow-2xl"
          style={{ width: canvasSize.width, height: canvasSize.height }}
        >
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            className="absolute inset-0 rounded-lg"
            style={{
              cursor: isEraser ? 'cell' : 'crosshair',
              touchAction: 'none',
              background: '#fff'
            }}
          />
        </div>
      </div>

      {/* Bottom toolbar */}
      <div className="flex-shrink-0 bg-[#111118] border-t border-white/10 px-3 py-2">
        {/* Color palette */}
        <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => selectColor(c)}
              className="flex-shrink-0 rounded-full transition-all active:scale-90"
              style={{
                width: 28,
                height: 28,
                background: c,
                border: color === c && !isEraser ? '3px solid #7B2FFF' : '2px solid rgba(255,255,255,0.2)',
                boxShadow: color === c && !isEraser ? '0 0 8px #7B2FFF88' : 'none'
              }}
            />
          ))}
        </div>

        {/* Tools row */}
        <div className="flex items-center gap-2">
          {/* Brush sizes */}
          <div className="flex gap-1">
            {BRUSH_SIZES.map((bs, i) => (
              <button
                key={i}
                onClick={() => { setBrushSizeIdx(i); setIsEraser(false); }}
                className={`w-9 h-9 rounded-xl font-bold text-sm transition-all active:scale-90 ${
                  brushSizeIdx === i && !isEraser
                    ? 'bg-[#7B2FFF] text-white'
                    : 'bg-white/10 text-gray-300'
                }`}
              >
                {bs.label}
              </button>
            ))}
          </div>

          <div className="w-px h-8 bg-white/10 mx-1" />

          {/* Eraser */}
          <button
            onClick={() => setIsEraser(e => !e)}
            className={`px-3 h-9 rounded-xl font-semibold text-sm transition-all active:scale-90 ${
              isEraser ? 'bg-[#7B2FFF] text-white' : 'bg-white/10 text-gray-300'
            }`}
          >
            Eraser
          </button>

          <div className="flex-1" />

          {/* Undo */}
          <button
            onClick={undo}
            className="w-9 h-9 rounded-xl bg-white/10 text-gray-300 font-bold text-sm transition-all active:scale-90 hover:bg-white/20"
            title="Undo"
          >
            U
          </button>

          {/* Clear */}
          <button
            onClick={clear}
            className="px-3 h-9 rounded-xl bg-white/10 text-gray-300 font-semibold text-sm transition-all active:scale-90 hover:bg-red-500/20 hover:text-red-400"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
