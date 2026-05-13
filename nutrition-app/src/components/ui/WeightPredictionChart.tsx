'use client';
import { useEffect, useRef } from 'react';

export interface ChartPoint {
  date: string;
  y: number;
  label: string;
}

interface Props {
  actual: ChartPoint[];     // 実績（実線）
  predict: ChartPoint[];    // 予測（点線、actual の最終点と接続）
  target?: number;          // 目標体重ライン
  height?: number;
}

/**
 * 実績（実線・実点）と予測（点線・中空丸）を同じ Y/X 軸で描画
 */
export function WeightPredictionChart({ actual, predict, target, height = 200 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const allPoints = [...actual, ...predict];
    if (allPoints.length === 0) {
      ctx.fillStyle = '#8D95A2';
      ctx.font = '13px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('データなし', W / 2, H / 2);
      return;
    }

    const padL = 36, padR = 12, padT = 14, padB = 24;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const ys = allPoints.map((p) => p.y).concat(target != null ? [target] : []);
    const yMin0 = Math.min(...ys), yMax0 = Math.max(...ys);
    const yPad = Math.max((yMax0 - yMin0) * 0.15, 0.5);
    const yMin = yMin0 - yPad, yMax = yMax0 + yPad;
    const yRange = yMax - yMin || 1;
    const totalPoints = allPoints.length;
    const xStep = totalPoints > 1 ? innerW / (totalPoints - 1) : 0;

    // グリッド
    ctx.strokeStyle = '#F1F2F4';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#8D95A2';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const y = padT + (innerH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
      const v = yMax - (yRange / 4) * i;
      ctx.fillText(v.toFixed(1), padL - 6, y);
    }

    // 目標体重ライン
    if (target != null) {
      const ty = padT + ((yMax - target) / yRange) * innerH;
      if (ty >= padT && ty <= padT + innerH) {
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#FFA284';
        ctx.beginPath();
        ctx.moveTo(padL, ty);
        ctx.lineTo(W - padR, ty);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#E94527';
        ctx.textAlign = 'left';
        ctx.fillText(`目標 ${target}`, padL + 4, ty - 8);
      }
    }

    // 今日 = 実績の最終点位置
    const todayX = padL + (actual.length - 1) * xStep;
    const todayY = actual.length > 0
      ? padT + ((yMax - actual[actual.length - 1].y) / yRange) * innerH
      : 0;

    // 実績ライン（実線、塗りつぶしエリアあり）
    if (actual.length > 0) {
      const grad = ctx.createLinearGradient(0, padT, 0, padT + innerH);
      grad.addColorStop(0, 'rgba(255,95,61,0.25)');
      grad.addColorStop(1, 'rgba(255,95,61,0)');

      ctx.beginPath();
      actual.forEach((p, i) => {
        const x = padL + i * xStep;
        const y = padT + ((yMax - p.y) / yRange) * innerH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#FF5F3D';
      ctx.lineWidth = 2.4;
      ctx.lineJoin = 'round';
      ctx.stroke();
      // 塗り
      ctx.lineTo(padL + (actual.length - 1) * xStep, padT + innerH);
      ctx.lineTo(padL, padT + innerH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // 実点
      actual.forEach((p, i) => {
        const x = padL + i * xStep;
        const y = padT + ((yMax - p.y) / yRange) * innerH;
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#FF5F3D';
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 予測ライン（点線、中空丸）
    if (predict.length > 0 && actual.length > 0) {
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(todayX, todayY); // 実績最終点から接続
      predict.forEach((p, i) => {
        const x = padL + (actual.length - 1 + i + 1) * xStep;
        const y = padT + ((yMax - p.y) / yRange) * innerH;
        ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#FF7E58';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.setLineDash([]);

      // 中空丸
      predict.forEach((p, i) => {
        const x = padL + (actual.length + i) * xStep;
        const y = padT + ((yMax - p.y) / yRange) * innerH;
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#FF7E58';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    // X軸ラベル（実績の先頭・今日・予測の末尾）
    ctx.fillStyle = '#8D95A2';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const labelPoints: { x: number; label: string }[] = [];
    if (actual.length > 0) {
      labelPoints.push({ x: padL, label: actual[0].label });
      labelPoints.push({ x: todayX, label: '今日' });
    }
    if (predict.length > 0) {
      const lastIdx = totalPoints - 1;
      labelPoints.push({ x: padL + lastIdx * xStep, label: predict[predict.length - 1].label });
    }
    labelPoints.forEach((p) => {
      ctx.fillText(p.label, p.x, padT + innerH + 6);
    });
  }, [actual, predict, target, height]);

  return (
    <div>
      <canvas ref={ref} className="block w-full" style={{ height }} />
      {predict.length > 0 && (
        <div className="mt-2 flex items-center justify-end gap-3 text-[10px] text-ink-mute">
          <div className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-brand-500" /> 実績
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-brand-400 border-dashed" style={{ borderTopWidth: 1, borderTopStyle: 'dashed', borderColor: '#FF7E58' }} /> 予測
          </div>
        </div>
      )}
    </div>
  );
}
