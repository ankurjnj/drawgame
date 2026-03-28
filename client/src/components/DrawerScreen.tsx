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

// Fixed internal canvas resolution
const CANVAS_W = 1200;
const CANVAS_H = 900;

export default function DrawerScreen({ game }: Props) {
  const [color, setColor] = useState('#000000');
  const [brushSizeIdx, setBrushSizeIdx] = useState(1);
  const [isEraser, setIsEraser] = useState(false);
  const [zoom, setZoom] = useState(1);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [displaySize, setDisplaySize] = useState({ width: CANVAS_W, height: CANVAS_H });

  const { canvasRef, clear, undo } = useCanvas({
    color,
    brushSize: BRUSH_SIZES[brushSizeIdx].size,
    isEraser,
    canvasWidth: CANVAS_W,
    canvasHeight: CANVAS_H,
  });

  const giverName = game.roomState?.players.find(p => p.role === 'giver')?.name || 'Giver';

  // Responsive: fit canvas to available space, respecting zoom
  useEffect(() => {
    const measure = () => {
      if (!canvasWrapRef.current) return;
      const wrap = canvasWrapRef.current;
      const availW = wrap.clientWidth;
      const availH = wrap.clientHeight;
      const ratio = CANVAS_W / CANVAS_H;
      let w = availW;
      let h = availW / ratio;
      if (h > availH) { h = availH; w = availH * ratio; }
      setDisplaySize({ width: Math.floor(w * zoom), height: Math.floor(h * zoom) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (canvasWrapRef.current) ro.observe(canvasWrapRef.current);
    return () => ro.disconnect();
  }, [zoom]);

  const selectColor = (c: string) => { setColor(c); setIsEraser(false); };
  const zoomIn  = () => setZoom(z => Math.min(z + 0.25, 3));
  const zoomOut = () => setZoom(z => Math.max(z - 0.25, 0.5));
  const zoomReset = () => setZoom(1);

  return (
    <div className="w-full h-full flex flex-col bg-[#0a0a0f] overflow-hidden" style={{ maxHeight: '100dvh' }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#111118] border-b border-white/10 flex-shrink-0">
        <div className="flex-1 min-w-0 pr-3">
          <p className="text-xs text-gray-500 uppercase tracking-widest truncate">Drawing for {giverName}</p>
          {game.phase === 'hint_round' && game.currentHint && (
            <p className="text-[#7B2FFF] font-bold text-base leading-tight truncate">{game.currentHint}</p>
          )}
          {game.phase === 'character_input' && (
            <p className="text-gray-400 text-sm italic">Waiting for hint...</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Hint counter */}
          {game.phase === 'hint_round' && (
            <span className="text-gray-400 text-xs bg-white/10 px-2 py-1 rounded-lg">
              {game.hintIndex + 1}/{game.totalHints}
            </span>
          )}
          {game.phase === 'hint_round' && (
            <TimerRing value={game.timerValue} max={game.timerMax} size={44} />
          )}
        </div>
      </div>

      {/* Canvas scroll area */}
      <div
        ref={canvasWrapRef}
        className="flex-1 overflow-auto flex items-center justify-center bg-[#16161f]"
        style={{ minHeight: 0 }}
      >
        <div
          className="relative shadow-2xl flex-shrink-0"
          style={{ width: displaySize.width, height: displaySize.height }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="absolute inset-0 rounded-lg"
            style={{
              width: displaySize.width,
              height: displaySize.height,
              cursor: isEraser ? 'cell' : 'crosshair',
              touchAction: 'none',
              background: '#ffffff',
            }}
          />
        </div>
      </div>

      {/* Bottom toolbar */}
      <div className="flex-shrink-0 bg-[#111118] border-t border-white/10 px-3 pt-2 pb-3">

        {/* Color palette — scrollable */}
        <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1 scrollbar-hide">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => selectColor(c)}
              className="flex-shrink-0 rounded-full transition-all active:scale-90"
              style={{
                width: 26, height: 26,
                background: c,
                border: color === c && !isEraser ? '3px solid #7B2FFF' : '2px solid rgba(255,255,255,0.25)',
                boxShadow: color === c && !isEraser ? '0 0 8px #7B2FFF88' : 'none',
              }}
            />
          ))}
        </div>

        {/* Tools row */}
        <div className="flex items-center gap-1.5 flex-wrap">

          {/* Brush sizes */}
          <div className="flex gap-1">
            {BRUSH_SIZES.map((bs, i) => (
              <button key={i} onClick={() => { setBrushSizeIdx(i); setIsEraser(false); }}
                className={`w-9 h-9 rounded-xl font-bold text-sm transition-all active:scale-90 ${
                  brushSizeIdx === i && !isEraser ? 'bg-[#7B2FFF] text-white' : 'bg-white/10 text-gray-300'}`}>
                {bs.label}
              </button>
            ))}
          </div>

          <div className="w-px h-7 bg-white/10" />

          {/* Eraser */}
          <button onClick={() => setIsEraser(e => !e)}
            className={`px-3 h-9 rounded-xl font-semibold text-sm transition-all active:scale-90 ${
              isEraser ? 'bg-[#7B2FFF] text-white' : 'bg-white/10 text-gray-300'}`}>
            ⌫
          </button>

          <div className="w-px h-7 bg-white/10" />

          {/* Zoom controls */}
          <button onClick={zoomOut}  className="w-9 h-9 rounded-xl bg-white/10 text-gray-300 font-bold text-lg active:scale-90 hover:bg-white/20">−</button>
          <button onClick={zoomReset} className="px-2 h-9 rounded-xl bg-white/10 text-gray-400 text-xs active:scale-90 hover:bg-white/20 min-w-[44px]">
            {Math.round(zoom * 100)}%
          </button>
          <button onClick={zoomIn}   className="w-9 h-9 rounded-xl bg-white/10 text-gray-300 font-bold text-lg active:scale-90 hover:bg-white/20">+</button>

          <div className="flex-1" />

          {/* Undo */}
          <button onClick={undo}
            className="w-9 h-9 rounded-xl bg-white/10 text-gray-300 font-bold text-sm active:scale-90 hover:bg-white/20" title="Undo">
            ↩
          </button>

          {/* Clear */}
          <button onClick={clear}
            className="px-3 h-9 rounded-xl bg-white/10 text-gray-300 font-semibold text-sm active:scale-90 hover:bg-red-500/20 hover:text-red-400">
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
