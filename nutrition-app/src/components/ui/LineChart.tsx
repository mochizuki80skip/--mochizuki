'use client';
import { useEffect, useRef } from 'react';

export interface Point { y: number; label?: string; }

interface LineChartProps {
  points: Point[];
  height?: number;
  target?: number;
  color?: string;
}

export function LineChart({ points, height = 200, target, color = '#FF5F3D' }: LineChartProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    if (!points.length) {
      ctx.fillStyle = '#8D95A2';
      ctx.font = '13px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('データなし', W / 2, H / 2);
      return;
    }

    const padL = 36, padR = 12, padT = 14, padB = 24;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const ys = points.map((p) => p.y);
    const yMin0 = Math.min(...ys), yMax0 = Math.max(...ys);
    const yPad = Math.max((yMax0 - yMin0) * 0.15, 0.5);
    const yMin = yMin0 - yPad, yMax = yMax0 + yPad;
    const yRange = yMax - yMin || 1;
    const xStep = points.length > 1 ? innerW / (points.length - 1) : 0;

    // grid + Y labels
    ctx.strokeStyle = '#F1F2F4';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#8D95A2';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const y = padT + (innerH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padL, y); ctx.lineTo(W - padR, y);
      ctx.stroke();
      const v = yMax - (yRange / 4) * i;
      ctx.fillText(v.toFixed(1), padL - 6, y);
    }
    // target dashed line
    if (target != null) {
      const ty = padT + ((yMax - target) / yRange) * innerH;
      if (ty >= padT && ty <= padT + innerH) {
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#FFA284';
        ctx.beginPath(); ctx.moveTo(padL, ty); ctx.lineTo(W - padR, ty); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#E94527';
        ctx.textAlign = 'left';
        ctx.fillText(`目標 ${target}`, padL + 4, ty - 8);
      }
    }
    // line
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = padL + i * xStep;
      const y = padT + ((yMax - p.y) / yRange) * innerH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    // area
    const grad = ctx.createLinearGradient(0, padT, 0, padT + innerH);
    grad.addColorStop(0, 'rgba(255,95,61,0.25)');
    grad.addColorStop(1, 'rgba(255,95,61,0)');
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.lineTo(padL + (points.length - 1) * xStep, padT + innerH);
    ctx.lineTo(padL, padT + innerH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    // dots
    points.forEach((p, i) => {
      const x = padL + i * xStep;
      const y = padT + ((yMax - p.y) / yRange) * innerH;
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
    });
    // X labels
    ctx.fillStyle = '#8D95A2';
    ctx.textAlign = 'center';
    const idxs = points.length > 7 ? [0, Math.floor(points.length / 2), points.length - 1] : points.map((_, i) => i);
    idxs.forEach((i) => {
      const x = padL + i * xStep;
      ctx.fillText(points[i].label || '', x, padT + innerH + 14);
    });
  }, [points, height, target, color]);

  return <canvas ref={ref} className="block w-full" style={{ height }} />;
}

interface BarChartProps {
  bars: { value: number; label?: string }[];
  height?: number;
  color?: string;
  max?: number;
}

export function BarChart({ bars, height = 140, color = '#FF5F3D', max }: BarChartProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !bars.length) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    const padL = 8, padR = 8, padT = 12, padB = 22;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const m = (max ?? Math.max(...bars.map((b) => b.value))) || 1;
    const gap = 4;
    const bw = (innerW - gap * (bars.length - 1)) / bars.length;
    bars.forEach((b, i) => {
      const x = padL + i * (bw + gap);
      const h = (b.value / m) * innerH;
      const y = padT + innerH - h;
      ctx.fillStyle = color;
      const r = Math.min(bw / 2, 4);
      ctx.beginPath();
      ctx.moveTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.lineTo(x + bw - r, y);
      ctx.arcTo(x + bw, y, x + bw, y + r, r);
      ctx.lineTo(x + bw, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.fill();
      if (b.label) {
        ctx.fillStyle = '#8D95A2';
        ctx.font = '10px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.label, x + bw / 2, padT + innerH + 14);
      }
    });
  }, [bars, height, color, max]);
  return <canvas ref={ref} className="block w-full" style={{ height }} />;
}
