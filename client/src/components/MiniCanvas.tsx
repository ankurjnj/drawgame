import { useEffect, useRef } from 'react';
import { socket } from '../socket';

// Source canvas is always 1200x900
const SRC_W = 1200;
const SRC_H = 900;

interface Props {
  strokes?: any[];
  live?: boolean;
}

export default function MiniCanvas({ strokes = [], live = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const strokesRef = useRef<any[]>([]);

  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: any, scaleX: number, scaleY: number) => {
    if (!stroke?.points?.length) return;
    ctx.save();
    ctx.strokeStyle = stroke.color || '#000';
    ctx.lineWidth = (stroke.width || 2) * Math.min(scaleX, scaleY);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = stroke.eraser ? 'destination-out' : 'source-over';

    const pts = stroke.points;
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x * scaleX, pts[0].y * scaleY, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = stroke.color || '#000';
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
  };

  const getScale = (canvas: HTMLCanvasElement) => ({
    x: canvas.width / SRC_W,
    y: canvas.height / SRC_H,
  });

  const redrawAll = (list: any[]) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    const { x, y } = getScale(canvas);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    list.forEach(s => drawStroke(ctx, s, x, y));
  };

  // Set canvas size to match container on mount + resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      // Maintain 4:3 aspect
      const ratio = SRC_W / SRC_H;
      let cw = w, ch = w / ratio;
      if (ch > h) { ch = h; cw = h * ratio; }
      canvas.width  = Math.floor(cw);
      canvas.height = Math.floor(ch);
      canvas.style.width  = canvas.width + 'px';
      canvas.style.height = canvas.height + 'px';
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctxRef.current = ctx;
      redrawAll(strokesRef.current);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Draw strokes prop when it changes
  useEffect(() => {
    strokesRef.current = strokes;
    redrawAll(strokes);
  }, [strokes]);

  // Live mode — listen to socket events
  useEffect(() => {
    if (!live) return;

    const canvas = canvasRef.current;

    const handleStroke = (stroke: any) => {
      strokesRef.current.push(stroke);
      const ctx = ctxRef.current;
      if (!canvas || !ctx) return;
      const { x, y } = getScale(canvas);
      drawStroke(ctx, stroke, x, y);
    };

    const handleClear = () => {
      strokesRef.current = [];
      const ctx = ctxRef.current;
      if (!canvas || !ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const handleUndo = (data: any) => {
      if (data?.strokes) {
        strokesRef.current = data.strokes;
        redrawAll(data.strokes);
      }
    };

    const handleState = ({ strokes: s }: { strokes: any[] }) => {
      strokesRef.current = s;
      redrawAll(s);
    };

    socket.on('drawing_stroke', handleStroke);
    socket.on('drawing_clear', handleClear);
    socket.on('drawing_undo', handleUndo);
    socket.on('canvas_state', handleState);
    socket.emit('request_canvas_state');

    return () => {
      socket.off('drawing_stroke', handleStroke);
      socket.off('drawing_clear', handleClear);
      socket.off('drawing_undo', handleUndo);
      socket.off('canvas_state', handleState);
    };
  }, [live]);

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center bg-white">
      <canvas ref={canvasRef} style={{ display: 'block', background: '#fff' }} />
    </div>
  );
}
