// リッチメニューのレイアウト定義（ボタン数 × サイズ → 各ボタンの矩形）
export type Bounds = { x: number; y: number; width: number; height: number };

const SIZE = {
  large: { width: 2500, height: 1686 },
  compact: { width: 2500, height: 843 },
};

export function richMenuSize(size: string) {
  return size === "compact" ? SIZE.compact : SIZE.large;
}

// レイアウトごとのボタン矩形を返す
export function layoutBounds(layout: string, size: string): Bounds[] {
  const { width: W, height: H } = richMenuSize(size);
  switch (layout) {
    case "1":
      return [{ x: 0, y: 0, width: W, height: H }];
    case "2":
      return [
        { x: 0, y: 0, width: W / 2, height: H },
        { x: W / 2, y: 0, width: W / 2, height: H },
      ];
    case "3":
      return [
        { x: 0, y: 0, width: Math.floor(W / 3), height: H },
        { x: Math.floor(W / 3), y: 0, width: Math.floor(W / 3), height: H },
        { x: Math.floor((W / 3) * 2), y: 0, width: W - Math.floor((W / 3) * 2), height: H },
      ];
    case "4": {
      const hw = W / 2;
      const hh = H / 2;
      return [
        { x: 0, y: 0, width: hw, height: hh },
        { x: hw, y: 0, width: hw, height: hh },
        { x: 0, y: hh, width: hw, height: hh },
        { x: hw, y: hh, width: hw, height: hh },
      ];
    }
    case "6": {
      const tw = Math.floor(W / 3);
      const hh = H / 2;
      const bounds: Bounds[] = [];
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
          bounds.push({
            x: col === 2 ? tw * 2 : tw * col,
            y: row * hh,
            width: col === 2 ? W - tw * 2 : tw,
            height: hh,
          });
        }
      }
      return bounds;
    }
    default:
      return [{ x: 0, y: 0, width: W, height: H }];
  }
}

export function buttonCountForLayout(layout: string): number {
  return layoutBounds(layout, "large").length;
}
