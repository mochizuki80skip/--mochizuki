import { BODY_PART_LABEL, PAIN_SIDE_LABEL } from "@/lib/symptoms";
import type { PainStat } from "@/lib/analysis";

// --- Body coordinates ----------------------------------------------------
//
// The silhouette is drawn in a 200×520 viewBox so we can pin pain markers to
// fixed (x, y) coordinates. Each body part has up to three positions:
//
//   left  / right : sided structures (shoulder, knee, ankle, …)
//   center        : midline structures (neck, lower_back, …)
//
// "isBack" flags rear-of-body parts (背中, 腰, 臀部) which we still mark on
// the front silhouette but indicate with a small "後" badge so staff can
// tell them apart.

type Pos = { x: number; y: number };

type AreaPositions = {
  left?: Pos;
  right?: Pos;
  center?: Pos;
  isBack?: boolean;
};

const BODY_POSITIONS: Record<string, AreaPositions> = {
  neck: { center: { x: 100, y: 92 } },
  shoulder: { left: { x: 65, y: 110 }, right: { x: 135, y: 110 } },
  arm: { left: { x: 50, y: 165 }, right: { x: 150, y: 165 } },
  elbow: { left: { x: 32, y: 215 }, right: { x: 168, y: 215 } },
  wrist: { left: { x: 18, y: 290 }, right: { x: 182, y: 290 } },
  finger: { left: { x: 14, y: 315 }, right: { x: 186, y: 315 } },
  back: { center: { x: 100, y: 175 }, isBack: true },
  lower_back: { center: { x: 100, y: 250 }, isBack: true },
  hip: { left: { x: 78, y: 290 }, right: { x: 122, y: 290 } },
  buttock: { center: { x: 100, y: 305 }, isBack: true },
  knee: { left: { x: 78, y: 395 }, right: { x: 122, y: 395 } },
  lower_leg: { left: { x: 76, y: 440 }, right: { x: 124, y: 440 } },
  ankle: { left: { x: 76, y: 480 }, right: { x: 124, y: 480 } },
};

function positionFor(area: string, side: string | null): Pos | null {
  const p = BODY_POSITIONS[area];
  if (!p) return null;
  if (side === "left") return p.left || p.center || null;
  if (side === "right") return p.right || p.center || null;
  if (side === "both") {
    // For "both", we'll render two markers — caller handles this.
    return p.left || p.center || null;
  }
  return p.center || p.left || null;
}

function isAreaOnBack(area: string): boolean {
  return Boolean(BODY_POSITIONS[area]?.isBack);
}

// --- Marker styling ------------------------------------------------------

function strengthFill(avg: number): string {
  if (avg <= 1.5) return "#FECDD3"; // rose-200
  if (avg <= 2.5) return "#FDA4AF"; // rose-300
  if (avg <= 3.5) return "#FB7185"; // rose-400
  if (avg <= 4.5) return "#F43F5E"; // rose-500
  return "#E11D48";                  // rose-600
}

function markerRadius(count: number, maxCount: number): number {
  // Map count [1..max] to radius [8..18]; collapse to 10 if everything is
  // count=1.
  if (maxCount <= 1) return 10;
  const t = Math.min(1, count / maxCount);
  return 8 + Math.round(t * 10);
}

// --- Component -----------------------------------------------------------

export default function PainBodyDiagram({ pains }: { pains: PainStat[] }) {
  // "other" pains can't be plotted on a body — keep them aside for the list.
  const plottable = pains.filter((p) => p.area !== "other" && BODY_POSITIONS[p.area]);
  const others = pains.filter((p) => p.area === "other");

  if (pains.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-200 p-4 text-center text-xs text-ink-500">
        記録された痛みはありません
      </div>
    );
  }

  const maxCount = Math.max(...pains.map((p) => p.count));

  // Expand "both" entries into two markers (left + right).
  type Marker = {
    key: string;
    pos: Pos;
    side: "left" | "right" | null;
    isBack: boolean;
    pain: PainStat;
  };
  const markers: Marker[] = [];
  for (const p of plottable) {
    const back = isAreaOnBack(p.area);
    if (p.side === "both") {
      const lp = BODY_POSITIONS[p.area]?.left;
      const rp = BODY_POSITIONS[p.area]?.right;
      if (lp)
        markers.push({
          key: `${p.area}-L`,
          pos: lp,
          side: "left",
          isBack: back,
          pain: p,
        });
      if (rp)
        markers.push({
          key: `${p.area}-R`,
          pos: rp,
          side: "right",
          isBack: back,
          pain: p,
        });
    } else {
      const pos = positionFor(p.area, p.side);
      if (!pos) continue;
      markers.push({
        key: `${p.area}-${p.side ?? "C"}`,
        pos,
        side: (p.side as "left" | "right" | null) ?? null,
        isBack: back,
        pain: p,
      });
    }
  }

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[10px] tracking-widest text-ink-400 font-bold">
          痛みマップ
        </h3>
        <span className="text-[10px] text-ink-400">
          {plottable.length} 部位
          {others.length > 0 ? ` + その他 ${others.length}件` : ""}
        </span>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
        <div className="shrink-0">
          <svg
            viewBox="0 0 200 520"
            className="w-32 h-auto"
            role="img"
            aria-label="痛みのある部位を体にプロットしたシルエット"
          >
            {/* --- Silhouette --- */}
            <g fill="#F7F8FA" stroke="#A8AEB8" strokeWidth={1.5} strokeLinejoin="round">
              {/* Head */}
              <circle cx={100} cy={55} r={28} />
              {/* Neck */}
              <rect x={92} y={80} width={16} height={14} rx={2} />
              {/* Torso */}
              <path d="M 62 100 Q 56 100 56 110 L 56 280 Q 56 286 62 286 L 138 286 Q 144 286 144 280 L 144 110 Q 144 100 138 100 Z" />
              {/* Left arm */}
              <path d="M 56 105 L 32 200 L 12 285 Q 8 298 22 298 L 36 295 Q 42 200 62 110 Z" />
              {/* Right arm */}
              <path d="M 144 105 L 168 200 L 188 285 Q 192 298 178 298 L 164 295 Q 158 200 138 110 Z" />
              {/* Left leg */}
              <path d="M 64 286 L 60 482 Q 60 498 76 498 L 92 498 Q 96 498 96 482 L 100 286 Z" />
              {/* Right leg */}
              <path d="M 100 286 L 104 482 Q 104 498 108 498 L 124 498 Q 140 498 140 482 L 136 286 Z" />
              {/* Feet */}
              <ellipse cx={80} cy={502} rx={14} ry={6} />
              <ellipse cx={120} cy={502} rx={14} ry={6} />
              {/* Hands */}
              <circle cx={20} cy={310} r={9} />
              <circle cx={180} cy={310} r={9} />
            </g>

            {/* --- Pain markers --- */}
            {markers.map((m) => {
              const r = markerRadius(m.pain.count, maxCount);
              const fill = strengthFill(m.pain.avgStrength);
              return (
                <g key={m.key} aria-hidden>
                  {/* The marker itself */}
                  <circle
                    cx={m.pos.x}
                    cy={m.pos.y}
                    r={r}
                    fill={fill}
                    fillOpacity={0.85}
                    stroke="#FFFFFF"
                    strokeWidth={1.5}
                  />
                  {/* Count badge inside the marker */}
                  <text
                    x={m.pos.x}
                    y={m.pos.y + 3}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={700}
                    fill="#FFFFFF"
                  >
                    {m.pain.count}
                  </text>
                  {/* Back-of-body badge */}
                  {m.isBack && (
                    <g>
                      <circle
                        cx={m.pos.x + r - 2}
                        cy={m.pos.y - r + 2}
                        r={6}
                        fill="#0F1115"
                      />
                      <text
                        x={m.pos.x + r - 2}
                        y={m.pos.y - r + 5}
                        textAnchor="middle"
                        fontSize={7}
                        fontWeight={700}
                        fill="#FFFFFF"
                      >
                        後
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <ol className="space-y-1.5">
            {pains.map((p, i) => {
              const baseLabel =
                BODY_PART_LABEL[p.area] || p.area;
              const sideLabel = p.side
                ? PAIN_SIDE_LABEL[p.side as keyof typeof PAIN_SIDE_LABEL]
                : "";
              const isBack = isAreaOnBack(p.area);
              return (
                <li
                  key={`${p.area}:${p.side ?? ""}:${i}`}
                  className="flex items-baseline gap-2 text-xs"
                >
                  <span className="text-ink-400 tabular-nums w-4">
                    {i + 1}.
                  </span>
                  <span
                    className="inline-block w-2 h-2 rounded-full shrink-0"
                    style={{ background: strengthFill(p.avgStrength) }}
                  />
                  <span className="font-bold text-ink-900 truncate">
                    {sideLabel}
                    {baseLabel}
                    {isBack && (
                      <span className="ml-1 text-[9px] tracking-widest text-ink-400">
                        (後)
                      </span>
                    )}
                  </span>
                  <span className="ml-auto text-ink-500 tabular-nums shrink-0">
                    {p.count}日
                  </span>
                  <span className="text-rose-600 font-bold tabular-nums shrink-0">
                    {p.avgStrength}/5
                  </span>
                </li>
              );
            })}
          </ol>

          {others.length > 0 && (
            <div className="mt-3 pt-2 border-t border-ink-100">
              <div className="text-[10px] tracking-widest text-ink-400 mb-1">
                その他（自由記述）
              </div>
              <ul className="space-y-0.5">
                {others.map((p, i) => (
                  <li key={i} className="text-[11px] text-ink-700">
                    {p.label} ・ {p.count}日 / 強度 {p.avgStrength}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 pt-3 border-t border-ink-100 grid grid-cols-2 gap-2 text-[10px] text-ink-500">
        <div className="flex items-center gap-1.5">
          <span className="text-ink-400">サイズ:</span>
          <span className="inline-block w-2 h-2 rounded-full bg-rose-400" />
          <span className="inline-block w-3 h-3 rounded-full bg-rose-400" />
          <span className="inline-block w-4 h-4 rounded-full bg-rose-400" />
          <span className="text-ink-400 ml-1">頻度</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-ink-400">色:</span>
          <span className="inline-block w-3 h-3 rounded" style={{ background: "#FECDD3" }} />
          <span className="inline-block w-3 h-3 rounded" style={{ background: "#FB7185" }} />
          <span className="inline-block w-3 h-3 rounded" style={{ background: "#E11D48" }} />
          <span className="text-ink-400 ml-1">強度</span>
        </div>
      </div>
    </div>
  );
}
