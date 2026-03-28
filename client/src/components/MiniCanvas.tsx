import { useEffect, useRef } from 'react';
import { socket } from '../socket';

// Must match DrawerScreen's CANVAS_W/H exactly
const SRC_W = 1200;
const SRC_H = 900;

interface Props {
  strokes?: any[];
  live?: boolean;
}

export default function MiniCanvas({ strokes = [], live = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<any[]>([]);

  function getCtx() {
    return canvasRef.current?.getContext('2d') ?? null;
  }

  function drawStroke(ctx: CanvasRenderingContext2D, stroke: any) {
    if (!stroke?.points?.length) return;
    const scaleX = SRC_W / SRC_W; // canvas IS 1200×900, no scaling needed
    const scaleY = SRC_H / SRC_H;

    ctx.save();
    ctx.strokeStyle = stroke.color || '#000';
    ctx.lineWidth = stroke.width || 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = stroke.eraser ? 'destination-out' : 'source-over';

    const pts = stroke.points;
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x * scaleX, pts[0].y * scaleY, (stroke.width || 2) / 2, 0, Math.PI * 2);
      ctx.fillStyle = stroke.eraser ? 'rgba(0,0,0,1)' : (stroke.color || '#000');
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(pts[0].x * scaleX, pts[0].y * scaleY);
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i], prev = pts[i - 1];
        const mx = ((prev.x + p.x) / 2) * scaleX;
        const my = ((prev.y + p.y) / 2) * scaleY;
        ctx.quadraticCurveTo(prev.x * scaleX, prev.y * scaleY, mx, my);
      }
      ctx.lineTo(pts[pts.length - 1].x * scaleX, pts[pts.length - 1].y * scaleY);
      ctx.stroke();
    }
    ctx.restore();
  }

  function redrawAll(list: any[]) {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    list.forEach(s => drawStroke(ctx, s));
  }

  // Init canvas
  useEffect(() => {
    const ctx = getCtx();
    if (!ctx || !canvasRef.current) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }, []);

  // Static strokes prop
  useEffect(() => {
    if (!live) {
      strokesRef.current = strokes;
      redrawAll(strokes);
    }
  }, [strokes, live]);

  // Live socket mode
  useEffect(() => {
    if (!live) return;

    // Reset
    strokesRef.current = [];
    redrawAll([]);

    const handleStroke = (stroke: any) => {
      // Accumulate and redraw all — reliable, no clear glitch
      strokesRef.current = [...strokesRef.current, stroke];
      redrawAll(strokesRef.current);
    };

    const handleClear = () => {
      strokesRef.current = [];
      redrawAll([]);
    };

    const handleUndo = (data: any) => {
      if (data?.strokes) {
        strokesRef.current = data.strokes;
        redrawAll(data.strokes);
      }
    };

    const handleState = ({ strokes: s }: { strokes: any[] }) => {
      strokesRef.current = s || [];
      redrawAll(strokesRef.current);
    };

    socket.on('drawing_stroke', handleStroke);
    socket.on('drawing_clear', handleClear);
    socket.on('drawing_undo', handleUndo);
    socket.on('canvas_state', handleState);

    // Request existing strokes
    socket.emit('request_canvas_state');

    return () => {
      socket.off('drawing_stroke', handleStroke);
      socket.off('drawing_clear', handleClear);
      socket.off('drawing_undo', handleUndo);
      socket.off('canvas_state', handleState);
    };
  }, [live]);

  return (
    // CSS scales the fixed 1200×900 canvas to fit container — no JS resizing = no clearing
    <div className="w-full h-full flex items-center justify-center bg-white overflow-hidden">
      <canvas
        ref={canvasRef}
        width={SRC_W}
        height={SRC_H}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          display: 'block',
          background: '#fff',
        }}
      />
    </div>
  );
}
