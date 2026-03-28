import { useEffect, useRef } from 'react';
import { socket } from '../socket';

interface Props {
  strokes?: any[];
  live?: boolean;
  width?: number;
  height?: number;
}

export default function MiniCanvas({ strokes = [], live = false, width = 400, height = 300 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: any) => {
    if (!stroke || !stroke.points || stroke.points.length < 2) return;

    ctx.save();
    ctx.strokeStyle = stroke.color || '#000000';
    ctx.lineWidth = stroke.width || 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = stroke.eraser ? 'destination-out' : 'source-over';

    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      const p = stroke.points[i];
      const prev = stroke.points[i - 1];
      const midX = (prev.x + p.x) / 2;
      const midY = (prev.y + p.y) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
    }
    ctx.stroke();
    ctx.restore();
  };

  const redrawAll = (strokeList: any[]) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokeList.forEach(s => drawStroke(ctx, s));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;

    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (strokes.length > 0) {
      redrawAll(strokes);
    }
  }, []);

  useEffect(() => {
    if (strokes.length > 0) {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (!canvas || !ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      redrawAll(strokes);
    }
  }, [strokes]);

  useEffect(() => {
    if (!live) return;

    const handleStroke = (stroke: any) => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      drawStroke(ctx, stroke);
    };

    const handleClear = () => {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (!canvas || !ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const handleUndo = (strokeData: any) => {
      if (strokeData?.strokes) {
        redrawAll(strokeData.strokes);
      }
    };

    const handleCanvasState = ({ strokes: s }: { strokes: any[] }) => {
      redrawAll(s);
    };

    socket.on('drawing_stroke', handleStroke);
    socket.on('drawing_clear', handleClear);
    socket.on('drawing_undo', handleUndo);
    socket.on('canvas_state', handleCanvasState);

    // Request current canvas state
    socket.emit('request_canvas_state');

    return () => {
      socket.off('drawing_stroke', handleStroke);
      socket.off('drawing_clear', handleClear);
      socket.off('drawing_undo', handleUndo);
      socket.off('canvas_state', handleCanvasState);
    };
  }, [live]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="w-full h-full object-contain"
      style={{ background: '#fff' }}
    />
  );
}
