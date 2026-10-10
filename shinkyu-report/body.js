/* 人体図（前面・背面）の部位定義と SVG 描画
 * 座標系：1体あたり viewBox 0 0 200 400。左右は x=100 を軸に反転して作る。
 * 前面図は向かって左が患者様の「右」、背面図は向かって左が患者様の「左」。
 */
(function () {
  'use strict';

  const W = 200;
  const H = 392;

  const E = (cx, cy, rx, ry) => ({ t: 'e', cx, cy, rx, ry });
  const R = (x, y, w, h, r) => ({ t: 'r', x, y, w, h, r });
  const P = (...pts) => ({ t: 'p', pts });

  // 向かって左側のシェイプ。右側は mirror() で作る
  const mirror = (s) => {
    if (s.t === 'e') return E(W - s.cx, s.cy, s.rx, s.ry);
    if (s.t === 'r') return R(W - s.x - s.w, s.y, s.w, s.h, s.r);
    return P(...s.pts.map(([x, y]) => [W - x, y]));
  };

  // 共通の体型（向かって左半分 + 中央）
  const SHAPE = {
    head: E(100, 32, 19, 24),
    neck: R(90, 52, 20, 20, 5),
    shoulder: E(74, 80, 17, 9),
    upperTorso: R(76, 74, 24.5, 40, 7),
    arm: P([57, 84], [72, 86], [69, 140], [54, 138]),
    elbow: E(61, 146, 8, 8),
    forearm: P([53, 151], [68, 152], [63, 198], [51, 196]),
    wrist: E(57, 203, 7, 5),
    hand: E(55, 220, 9, 13),
    thigh: P([80, 170], [100.5, 170], [98, 256], [82, 256]),
    knee: E(90, 265, 10, 10),
    shin: P([82, 273], [98, 273], [95, 350], [85, 350]),
    ankle: E(90, 356, 7, 6),
    foot: E(89, 372, 9, 11),
  };

  // [キー, 前面の名称, 背面の名称, グループ]
  const LIMBS = [
    ['shoulder', '肩（前面）', '肩（僧帽筋）', '肩'],
    ['upperTorso', '胸部', '肩甲骨部', '体幹'],
    ['arm', '上腕（前面）', '上腕（後面）', '腕'],
    ['elbow', '肘（前面）', '肘', '腕'],
    ['forearm', '前腕（前面）', '前腕（後面）', '腕'],
    ['wrist', '手首（掌側）', '手首（甲側）', '腕'],
    ['hand', '手のひら', '手の甲', '腕'],
    ['thigh', '大腿（前面）', '大腿（後面）', '脚'],
    ['knee', '膝', '膝裏', '脚'],
    ['shin', 'すね', 'ふくらはぎ', '脚'],
    ['ankle', '足首（前面）', 'アキレス腱', '脚'],
    ['foot', '足（甲）', 'かかと・足底', '脚'],
  ];

  const REGIONS = [];
  const baseSeq = {};
  const add = (id, view, name, side, group, shape) => {
    const base = id.replace(/-[rl]$/, '');
    if (!(base in baseSeq)) baseSeq[base] = Object.keys(baseSeq).length;
    REGIONS.push({ id, view, name, side, group, shape, base: baseSeq[base] });
  };

  // ---- 前面 ----
  add('f-head', 'f', '頭・顔', '', '頭・首', SHAPE.head);
  add('f-neck', 'f', '首（前面）', '', '頭・首', SHAPE.neck);
  add('f-abd', 'f', '腹部', '', '体幹', R(78, 112, 44, 40, 6));
  add('f-lowabd', 'f', '下腹部・鼠径部', '', '体幹', R(80, 150, 40, 26, 8));
  // ---- 背面 ----
  add('b-head', 'b', '後頭部', '', '頭・首', SHAPE.head);
  add('b-neck', 'b', '首（後面）', '', '頭・首', SHAPE.neck);

  LIMBS.forEach(([key, fName, bName, group]) => {
    const left = SHAPE[key];
    const right = mirror(left);
    // 前面：向かって左が患者様の右
    add(`f-${key}-r`, 'f', fName, '右', group, left);
    add(`f-${key}-l`, 'f', fName, '左', group, right);
    // 背面：向かって左が患者様の左
    add(`b-${key}-l`, 'b', bName, '左', group, left);
    add(`b-${key}-r`, 'b', bName, '右', group, right);
  });

  // 背面の体幹（左右別）
  [
    ['back', '背中', R(78, 112, 22.5, 32, 5)],
    ['waist', '腰', R(79, 142, 21.5, 20, 5)],
    ['hip', '臀部', E(90, 172, 12.5, 12)],
  ].forEach(([key, name, left]) => {
    add(`b-${key}-l`, 'b', name, '左', '背中・腰', left);
    add(`b-${key}-r`, 'b', name, '右', '背中・腰', mirror(left));
  });

  // 描画順（後に描いたものが上）：体幹 → 四肢 → 肩
  const ORDER = ['head', 'neck', 'upperTorso', 'abd', 'lowabd', 'back', 'waist', 'thigh', 'hip',
    'knee', 'shin', 'ankle', 'foot', 'arm', 'elbow', 'forearm', 'wrist', 'hand', 'shoulder'];
  const orderOf = (r) => {
    const key = r.id.split('-')[1];
    const i = ORDER.indexOf(key);
    return i < 0 ? 99 : i;
  };
  REGIONS.sort((a, b) => orderOf(a) - orderOf(b));

  const BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r]));
  const GROUPS = ['頭・首', '肩', '腕', '体幹', '背中・腰', '脚'];

  // 前面・背面で名称が重ならないようにしてあるので、左右＋名称で一意になる
  const label = (r) => `${r.side}${r.name}`;

  const shapeSvg = (s, attrs) => {
    if (s.t === 'e') return `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" ${attrs}/>`;
    if (s.t === 'r') return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r}" ${attrs}/>`;
    return `<polygon points="${s.pts.map((p) => p.join(',')).join(' ')}" stroke-linejoin="round" ${attrs}/>`;
  };

  const center = (s) => {
    if (s.t === 'e') return [s.cx, s.cy];
    if (s.t === 'r') return [s.x + s.w / 2, s.y + s.h / 2];
    const n = s.pts.length;
    return [s.pts.reduce((a, p) => a + p[0], 0) / n, s.pts.reduce((a, p) => a + p[1], 0) / n];
  };

  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /**
   * 1体ぶんの SVG
   * @param {'f'|'b'} view
   * @param {{selected: Object<string, number>, pins: Array}} st selected: 部位id → 表示番号
   */
  function figure(view, st, opts = {}) {
    const regs = REGIONS.filter((r) => r.view === view);
    const sil = regs.map((r) => shapeSvg(r.shape, '')).join('');
    const parts = regs.map((r) => {
      const on = st.selected[r.id] != null;
      return shapeSvg(r.shape, `class="rg${on ? ' on' : ''}" data-id="${r.id}"`);
    }).join('');
    const badges = regs.filter((r) => st.selected[r.id] != null).map((r) => {
      const [x, y] = center(r.shape);
      return `<g class="badge" pointer-events="none"><circle cx="${x}" cy="${y}" r="6.2"/><text x="${x}" y="${y + 2.6}">${st.selected[r.id]}</text></g>`;
    }).join('');
    const pins = (st.pins || []).map((p, i) => ({ p, i })).filter(({ p }) => p.view === view).map(({ p, i }) =>
      `<g class="pin" data-pin="${i}"><circle cx="${p.x}" cy="${p.y}" r="2.6"/><text x="${p.x + 4}" y="${p.y - 3}">${pinLabel(i)}</text></g>`
    ).join('');
    const isFront = view === 'f';
    const sideL = isFront ? '右' : '左';
    const sideR = isFront ? '左' : '右';
    return `<svg class="body-svg${opts.cls ? ' ' + opts.cls : ''}" viewBox="0 -14 ${W} ${H + 14}" data-view="${view}" xmlns="http://www.w3.org/2000/svg">
      <text class="cap" x="${W / 2}" y="-3">${isFront ? '前面' : '背面'}</text>
      <text class="side" x="40" y="-3">${sideL}</text><text class="side" x="${W - 40}" y="-3">${sideR}</text>
      <g class="sil">${sil}</g><g class="parts">${parts}</g>${badges}${pins}
    </svg>`;
  }

  const PIN_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const pinLabel = (i) => (i < 26 ? PIN_LABELS[i] : `Z${i - 25}`);

  // 点の座標がどの部位に入るか（上に描かれたものを優先）
  function regionAt(view, x, y) {
    const regs = REGIONS.filter((r) => r.view === view);
    for (let i = regs.length - 1; i >= 0; i--) {
      const s = regs[i].shape;
      if (s.t === 'e') {
        if (((x - s.cx) / s.rx) ** 2 + ((y - s.cy) / s.ry) ** 2 <= 1) return regs[i];
      } else if (s.t === 'r') {
        if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return regs[i];
      } else {
        let inside = false;
        const p = s.pts;
        for (let a = 0, b = p.length - 1; a < p.length; b = a++) {
          if ((p[a][1] > y) !== (p[b][1] > y) &&
              x < ((p[b][0] - p[a][0]) * (y - p[a][1])) / (p[b][1] - p[a][1]) + p[a][0]) inside = !inside;
        }
        if (inside) return regs[i];
      }
    }
    return null;
  }

  window.Body = { REGIONS, BY_ID, GROUPS, figure, label, pinLabel, regionAt, esc };
})();
