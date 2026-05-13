/* Minimal Canvas charts — no external deps */

function drawRing(canvas, value, target, color) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const size = canvas.clientWidth;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  ctx.scale(dpr, dpr);
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - 6;
  const pct = target > 0 ? Math.min(value / target, 1.2) : 0;
  ctx.clearRect(0, 0, size, size);
  // bg
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.stroke();
  // fg
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(pct, 1));
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.stroke();
  if (pct > 1) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (pct - 1));
    ctx.strokeStyle = '#e0594d';
    ctx.stroke();
  }
  // center text
  ctx.fillStyle = '#f4f6f8';
  ctx.font = `600 ${Math.round(size * 0.22)}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(pct * 100)}%`, cx, cy);
}

function drawLine(canvas, points, opts = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  if (!points || points.length === 0) {
    ctx.fillStyle = '#6b7689';
    ctx.font = '13px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('データなし', W / 2, H / 2);
    return;
  }
  const padL = 36, padR = 12, padT = 14, padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const ys = points.map((p) => p.y);
  const yMinRaw = Math.min(...ys), yMaxRaw = Math.max(...ys);
  const yPad = Math.max((yMaxRaw - yMinRaw) * 0.15, 0.5);
  const yMin = yMinRaw - yPad, yMax = yMaxRaw + yPad;
  const yRange = yMax - yMin || 1;
  const xStep = points.length > 1 ? innerW / (points.length - 1) : 0;

  // gridlines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#6b7689';
  ctx.font = '10px -apple-system, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const y = padT + (innerH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();
    const val = yMax - (yRange / 4) * i;
    ctx.fillText(val.toFixed(1), padL - 6, y);
  }
  // target line
  if (opts.target != null) {
    const ty = padT + ((yMax - opts.target) / yRange) * innerH;
    if (ty >= padT && ty <= padT + innerH) {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(26,139,77,0.7)';
      ctx.beginPath();
      ctx.moveTo(padL, ty);
      ctx.lineTo(W - padR, ty);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#1a8b4d';
      ctx.textAlign = 'left';
      ctx.fillText('目標 ' + opts.target, padL + 4, ty - 8);
    }
  }
  // line + area
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = padL + i * xStep;
    const y = padT + ((yMax - p.y) / yRange) * innerH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  const grad = ctx.createLinearGradient(0, padT, 0, padT + innerH);
  grad.addColorStop(0, 'rgba(26,139,77,0.35)');
  grad.addColorStop(1, 'rgba(26,139,77,0)');
  // stroke
  ctx.strokeStyle = '#21a85d';
  ctx.lineWidth = 2.2;
  ctx.lineJoin = 'round';
  ctx.stroke();
  // area
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
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#21a85d';
    ctx.fill();
  });
  // x labels (first / mid / last)
  ctx.fillStyle = '#6b7689';
  ctx.textAlign = 'center';
  const labelIdx = points.length > 7 ? [0, Math.floor(points.length / 2), points.length - 1] : points.map((_, i) => i);
  labelIdx.forEach((i) => {
    const x = padL + i * xStep;
    ctx.fillText(points[i].label || '', x, padT + innerH + 14);
  });
}

window.charts = { drawRing, drawLine };
