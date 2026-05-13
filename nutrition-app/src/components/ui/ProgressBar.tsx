'use client';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  target: number;
  color?: string;
  className?: string;
  showOver?: boolean;
}

export function ProgressBar({ value, target, color = 'bg-brand-500', className, showOver = true }: ProgressBarProps) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  const over = target > 0 && value > target;
  return (
    <div className={cn('w-full h-2 bg-ink-line rounded-full overflow-hidden relative', className)}>
      <div className={cn('h-full rounded-full transition-all', color, over && showOver && 'opacity-70')} style={{ width: `${pct}%` }} />
      {over && showOver && (
        <div className="absolute inset-0 flex items-center justify-end pr-1">
          <span className="text-[10px] font-bold text-red-500">+{Math.round(value - target)}</span>
        </div>
      )}
    </div>
  );
}

interface RingProps {
  value: number;
  target: number;
  size?: number;
  color?: string;
  label?: string;
}

export function Ring({ value, target, size = 64, color = '#FF5F3D', label }: RingProps) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = target > 0 ? Math.min(value / target, 1) : 0;
  const dash = c * pct;
  return (
    <svg width={size} height={size} className="block">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1F2F4" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${c}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x={size / 2} y={size / 2 + 4}
        textAnchor="middle"
        fontSize={size * 0.25}
        fontWeight={700}
        fill="#1A1D21"
      >{Math.round((value / Math.max(target, 1)) * 100)}%</text>
      {label && (
        <text x={size / 2} y={size - 4} textAnchor="middle" fontSize={9} fill="#8D95A2">{label}</text>
      )}
    </svg>
  );
}
