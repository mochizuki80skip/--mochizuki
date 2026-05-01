// 体図の背景 — public/chart/body-front.png / body-back.png を SVG <image> として描画。
// SVG の viewBox は 0..100 を維持し、画像を viewBox 全体にフィットさせる。
// イラストは縦長 (h:w ≒ 1.4) なので、viewBox は幅 100 × 高さ 140 に変更。

type Props = {
  view: "front" | "back";
};

export default function BodySilhouette({ view }: Props) {
  const src = view === "front" ? "/chart/body-front.png" : "/chart/body-back.png";
  return (
    <image
      href={src}
      x={0}
      y={0}
      width={100}
      height={140}
      preserveAspectRatio="xMidYMid meet"
      style={{ pointerEvents: "none" }}
    />
  );
}
