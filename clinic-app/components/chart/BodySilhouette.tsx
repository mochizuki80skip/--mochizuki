// Stylized human silhouette (simplified). Drawn at viewBox 100x130 so we can
// still address marker positions in 0..100 x / 0..100 y (note: y上限は ~95)。
// front/back の2バリエーションをサポート。

type Props = {
  view: "front" | "back";
  layer: "skeleton" | "muscle";
};

export default function BodySilhouette({ view, layer }: Props) {
  const stroke = "#0F1115";
  const skin = layer === "muscle" ? "#FFF1E0" : "#FAFAFA";
  const lineW = 0.6;

  return (
    <g>
      {/* 頭 */}
      <ellipse cx={50} cy={8} rx={6.5} ry={7.5} fill={skin} stroke={stroke} strokeWidth={lineW} />
      {/* 首 */}
      <rect x={47} y={14} width={6} height={4} fill={skin} stroke={stroke} strokeWidth={lineW} />
      {/* 胴体 (台形 + 腰のくびれ) */}
      <path
        d="M 32 18 Q 35 17 50 17 Q 65 17 68 18 L 70 32 Q 71 42 68 50 Q 66 56 60 58 L 60 60 L 40 60 L 40 58 Q 34 56 32 50 Q 29 42 30 32 Z"
        fill={skin}
        stroke={stroke}
        strokeWidth={lineW}
      />
      {/* 骨盤・尻 */}
      <path
        d="M 38 58 L 62 58 L 64 70 Q 60 72 50 72 Q 40 72 36 70 Z"
        fill={skin}
        stroke={stroke}
        strokeWidth={lineW}
      />
      {/* 左腕 */}
      <path
        d="M 32 19 L 23 28 L 20 38 L 17 50 L 16 58 L 18 58 L 21 50 L 25 38 L 30 30 Z"
        fill={skin}
        stroke={stroke}
        strokeWidth={lineW}
      />
      {/* 右腕 */}
      <path
        d="M 68 19 L 77 28 L 80 38 L 83 50 L 84 58 L 82 58 L 79 50 L 75 38 L 70 30 Z"
        fill={skin}
        stroke={stroke}
        strokeWidth={lineW}
      />
      {/* 左脚 */}
      <path
        d="M 38 70 L 36 86 L 36 100 L 41 100 L 43 86 L 45 70 Z"
        fill={skin}
        stroke={stroke}
        strokeWidth={lineW}
      />
      {/* 右脚 */}
      <path
        d="M 62 70 L 64 86 L 64 100 L 59 100 L 57 86 L 55 70 Z"
        fill={skin}
        stroke={stroke}
        strokeWidth={lineW}
      />

      {/* 骨格レイヤー: 脊柱 / 鎖骨ガイド (背面で目立たせる) */}
      {layer === "skeleton" && (
        <g stroke="#94A3B8" strokeWidth={0.4} fill="none" opacity={0.9}>
          {view === "back" && (
            <>
              {/* 脊椎 */}
              <line x1={50} y1={19} x2={50} y2={56} strokeDasharray="0.8 0.8" />
              {/* 椎骨マーク */}
              {Array.from({ length: 10 }).map((_, i) => (
                <line
                  key={i}
                  x1={48}
                  x2={52}
                  y1={20 + i * 3.5}
                  y2={20 + i * 3.5}
                />
              ))}
              {/* 仙骨 */}
              <path d="M 47 56 L 53 56 L 51 64 L 49 64 Z" stroke="#94A3B8" fill="none" />
              {/* 肩甲骨 */}
              <path d="M 36 20 L 44 28 L 40 32 Z" />
              <path d="M 64 20 L 56 28 L 60 32 Z" />
              {/* 骨盤の腸骨稜 */}
              <path d="M 38 58 Q 42 56 50 56 Q 58 56 62 58" />
            </>
          )}
          {view === "front" && (
            <>
              {/* 鎖骨 */}
              <path d="M 36 19 Q 43 17 50 19 Q 57 17 64 19" />
              {/* 胸骨 */}
              <line x1={50} y1={20} x2={50} y2={32} />
              {/* 肋骨ガイド */}
              <path d="M 40 24 Q 50 27 60 24" />
              <path d="M 38 28 Q 50 32 62 28" />
              <path d="M 38 32 Q 50 36 62 32" />
              {/* 骨盤 */}
              <path d="M 38 56 Q 50 60 62 56" />
            </>
          )}
        </g>
      )}

      {/* 筋肉レイヤー: 大まかな筋肉ガイド */}
      {layer === "muscle" && (
        <g stroke="#D97706" strokeWidth={0.4} fill="none" opacity={0.7}>
          {view === "back" && (
            <>
              {/* 僧帽筋 */}
              <path d="M 42 18 Q 50 14 58 18 L 62 30 L 50 36 L 38 30 Z" />
              {/* 広背筋 */}
              <path d="M 36 32 Q 50 38 64 32 L 60 50 Q 50 52 40 50 Z" />
              {/* 大臀筋 */}
              <path d="M 38 60 Q 50 56 62 60 L 64 70 Q 50 72 36 70 Z" />
              {/* ハムストリング */}
              <path d="M 38 72 Q 41 80 41 90" />
              <path d="M 62 72 Q 59 80 59 90" />
            </>
          )}
          {view === "front" && (
            <>
              {/* 三角筋 */}
              <path d="M 32 20 Q 28 26 30 32" />
              <path d="M 68 20 Q 72 26 70 32" />
              {/* 大胸筋 */}
              <path d="M 40 22 Q 50 28 60 22 L 62 32 Q 50 36 38 32 Z" />
              {/* 腹直筋 */}
              <line x1={50} y1={32} x2={50} y2={56} />
              <line x1={46} y1={36} x2={54} y2={36} />
              <line x1={46} y1={40} x2={54} y2={40} />
              <line x1={46} y1={44} x2={54} y2={44} />
              <line x1={46} y1={48} x2={54} y2={48} />
              {/* 大腿四頭筋 */}
              <path d="M 41 72 Q 41 80 41 88" />
              <path d="M 59 72 Q 59 80 59 88" />
            </>
          )}
        </g>
      )}
    </g>
  );
}
