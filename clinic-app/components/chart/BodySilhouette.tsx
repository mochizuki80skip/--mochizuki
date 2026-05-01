// 体図の背景 — public/chart/body-front.png / body-back.png
// 画像は 1200×1600px (3:4 比) → SVG viewBox 100×133.33 にぴったり収める。

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
      height={133.33}
      preserveAspectRatio="xMidYMid meet"
      style={{ pointerEvents: "none" }}
    />
  );
}
