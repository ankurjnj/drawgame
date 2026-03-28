import { useEffect, useRef, useCallback } from 'react';
import { socket } from '../socket';

interface StrokePoint {
  x: number;
  y: number;
  pressure?: number;
}

interface Stroke {
  points: StrokePoint[];
  color: string;
  width: number;
  eraser: boolean;
}

interface UseCanvasOptions {
  color: string;
  brushSize: number;
  isEraser: boolean;
  canvasWidth?: number;
  canvasHeight?: number;
}

export function useCanvas(options: UseCanvasOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawing = useRef(false);
  const currentStroke = useRef<Stroke | null>(null);
  const strokeHistory = useRef<Stroke[]>([]);
  const optionsRef = useRef(options);

  // Keep options ref current
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (!stroke.points || stroke.points.length < 1) return;

    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = stroke.eraser ? 'destination-out' : 'source-over';

    if (stroke.points.length === 1) {
      // Single dot
      ctx.beginPath();
      ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.width / 2, 0, Math.PI * 2);
      ctx.fillStyle = stroke.eraser ? 'rgba(0,0,0,1)' : stroke.color;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        const p = stroke.points[i];
        const prev = stroke.points[i - 1];
        const midX = (prev.x + p.x) / 2;
        const midY = (prev.y + p.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
      }
      ctx.lineTo(stroke.points[stroke.points.length - 1].x, stroke.points[stroke.points.length - 1].y);
      ctx.stroke();
    }
    ctx.restore();
  }, []);

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    strokeHistory.current.forEach(s => drawStroke(ctx, s));
  }, [drawStroke]);

  const getPoint = (e: MouseEvent | Touch, canvas: HTMLCanvasElement): StrokePoint => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let pressure = 0.5;
    if ('force' in e && typeof (e as any).force === 'number') {
      pressure = (e as any).force || 0.5;
    }

    return {
      x: (('clientX' in e ? e.clientX : 0) - rect.left) * scaleX,
      y: (('clientY' in e ? e.clientY : 0) - rect.top) * scaleY,
      pressure
    };
  };

  const startStroke = useCallback((point: StrokePoint) => {
    const { color, brushSize, isEraser } = optionsRef.current;
    isDrawing.current = true;
    currentStroke.current = {
      points: [point],
      color: isEraser ? '#ffffff' : color,
      width: isEraser ? brushSize * 3 : brushSize,
      eraser: isEraser
    };
  }, []);

  const continueStroke = useCallback((point: StrokePoint) => {
    if (!isDrawing.current || !currentStroke.current) return;
    const ctx = ctxRef.current;
    if (!ctx) return;

    currentStroke.current.points.push(point);

    // Draw incrementally
    const points = currentStroke.current.points;
    const len = points.length;

    if (len >= 2) {
      ctx.save();
      ctx.strokeStyle = currentStroke.current.color;
      ctx.lineWidth = currentStroke.current.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = currentStroke.current.eraser ? 'destination-out' : 'source-over';

      ctx.beginPath();
      if (len === 2) {
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
      } else {
        const p = points[len - 1];
        const prev = points[len - 2];
        const pprev = points[len - 3];
        const midX1 = (pprev.x + prev.x) / 2;
        const midY1 = (pprev.y + prev.y) / 2;
        const midX2 = (prev.x + p.x) / 2;
        const midY2 = (prev.y + p.y) / 2;
        ctx.moveTo(midX1, midY1);
        ctx.quadraticCurveTo(prev.x, prev.y, midX2, midY2);
      }
      ctx.stroke();
      ctx.restore();
    }
  }, []);

  const endStroke = useCallback(() => {
    if (!isDrawing.current || !currentStroke.current) return;
    isDrawing.current = false;

    const stroke = currentStroke.current;
    strokeHistory.current.push(stroke);
    if (strokeHistory.current.length > 10) {
      strokeHistory.current.shift();
    }

    // Emit to server
    socket.emit('drawing_stroke', stroke);

    currentStroke.current = null;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;

    // Initial white fill
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Mouse events
    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      startStroke(getPoint(e, canvas));
    };
    const onMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      if (isDrawing.current) continueStroke(getPoint(e, canvas));
    };
    const onMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      endStroke();
    };

    // Touch events
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      startStroke(getPoint(touch, canvas));
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (isDrawing.current) continueStroke(getPoint(touch, canvas));
    };
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      endStroke();
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [startStroke, continueStroke, endStroke]);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    strokeHistory.current = [];
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    socket.emit('drawing_clear');
  }, []);

  const undo = useCallback(() => {
    if (strokeHistory.current.length === 0) return;
    strokeHistory.current.pop();
    redrawAll();
    socket.emit('drawing_undo', { strokes: strokeHistory.current });
  }, [redrawAll]);

  return { canvasRef, clear, undo };
}
