type Props = {
  current: number; // 1-based current step
  total: number;
};

export default function ProgressBar({ current, total }: Props) {
  const pct = Math.max(0, Math.min(100, (current / total) * 100));
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-ink-500 mb-1.5">
        <span className="tabular-nums">
          <span className="text-ink-900 font-bold">{current}</span>
          <span className="mx-1">/</span>
          <span>{total}</span>
        </span>
        <span className="tabular-nums">{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 w-full bg-ink-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
