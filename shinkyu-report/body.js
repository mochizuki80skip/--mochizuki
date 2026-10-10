/* 人体図の部位定義と SVG 描画
 * 身体（前面・背面）と頭部（顔の前面・右側面・左側面・後頭部）の2種類。
 * 座標系：幅 200。身体は高さ 392、頭部は高さ 200（同じ線の太さ・色・部位の塗りで描く）。
 * 左右は x=100 を軸に反転して作る。前面図は向かって左が患者様の「右」、背面図は向かって左が「左」。
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
  let curSet = 'body';
  const add = (id, view, name, side, group, shape) => {
    const base = id.replace(/-[rl]$/, '');
    if (!(base in baseSeq)) baseSeq[base] = Object.keys(baseSeq).length;
    REGIONS.push({ id, view, name, side, group, shape, base: baseSeq[base], set: curSet });
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

  // =====================================================================
  // 頭部（顔の前面・右側面・左側面・後頭部）。描画は追加した順（後のものが上）
  // =====================================================================
  curSet = 'head';
  // 楕円上の点列（角度は度。0=右、90=下）
  const arc = (cx, cy, rx, ry, a0, a1, n = 14) => Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    return [Math.round((cx + rx * Math.cos(a)) * 10) / 10, Math.round((cy + ry * Math.sin(a)) * 10) / 10];
  });
  const deg = (v) => (Math.asin(v) * 180) / Math.PI;

  // 顔（前面）・後頭部で使う頭の楕円
  const HX = 100, HY = 80, HRX = 46, HRY = 58;
  const hA = (y) => deg((y - HY) / HRY);            // 右側（向かって右）の角度
  const hL = (y) => 180 - hA(y);                     // 左側（向かって左）の角度
  const hArc = (a0, a1, n) => arc(HX, HY, HRX, HRY, a0, a1, n);
  const SHOULDER = P([74, 170], [100.5, 170], [100.5, 200], [14, 200], [22, 190], [56, 180]);

  // 顔（前面）：向かって左が患者様の右
  const FACE = [
    // [キー, 名称, グループ, 向かって左側のシェイプ, 左右あり]
    ['shoulder', '鎖骨・肩上部', '首・肩', SHOULDER, true],
    ['neck', '首（前面）', '首・肩', P([80, 126], [100.5, 126], [100.5, 178], [74, 178]), true],
    ['ear', '耳', '耳', E(52, 86, 7, 14), true],
    ['top', '前頭部', '頭', P(...hArc(hL(60), 360 + hA(60), 20)), false],
    ['temple', 'こめかみ', '頭', P(...hArc(hL(60), hL(92), 6), [70, 92], [70, 60]), true],
    ['eye', '目の周り', '顔', R(70, 60, 30.5, 32, 4), true],
    ['cheek', '頬', '顔', P(...hArc(hL(92), hL(120), 6), [84, 120], [84, 92]), true],
    ['nose', '鼻・口周り', '顔', R(84, 92, 32, 28, 6), false],
    ['chin', '顎', '顔', P(...hArc(hL(120), hA(120), 16)), false],
  ];
  FACE.forEach(([key, name, group, shape, lr]) => {
    if (!lr) { add(`hf-${key}`, 'hf', name, '', group, shape); return; }
    add(`hf-${key}-r`, 'hf', name, '右', group, shape);
    add(`hf-${key}-l`, 'hf', name, '左', group, mirror(shape));
  });

  // 側面（右側面を作り、左側面は反転）。顔は向かって右を向く
  const SX = 95, SY = 78, SRX = 50, SRY = 56;
  const sA = (y) => deg((y - SY) / SRY);
  const sArc = (a0, a1, n) => arc(SX, SY, SRX, SRY, a0, a1, n);
  const SIDE = [
    ['shoulder', '肩上部', '首・肩', P([46, 172], [124, 172], [160, 200], [10, 200], [24, 186]), true],
    ['neck', '首（側面）', '首・肩', P([60, 112], [112, 132], [118, 180], [56, 180], [54, 146]), true],
    ['back', '後頭部', '頭', P(...sArc(180 - sA(58), 180 - sA(112), 8), [72, 112], [72, 58]), false],
    ['temple', '側頭部', '頭', R(72, 58, 52, 44, 4), true],
    ['top', '頭頂部', '頭', P(...sArc(180 - sA(58), 360 + sA(58), 16)), false],
    ['behind', '耳の後ろ・耳下', '耳', P([72, 100], [100, 100], [104, 132], [60, 118]), true],
    ['face', '頬・顎（側面）', '顔', P([124, 58], [140, 57], [146, 68], [147, 82], [157, 96], [148, 101], [149, 108],
      [145, 113], [147, 119], [140, 131], [126, 137], [104, 132], [100, 100], [124, 100]), true],
    ['ear', '耳', '耳', E(92, 88, 9, 15), true],
  ];
  // 側面の部位はすべて左右どちらかの面
  SIDE.forEach(([key, name, group, shape]) => add(`hr-${key}`, 'hr', name, '右', group, shape));
  SIDE.forEach(([key, name, group, shape]) => add(`hl-${key}`, 'hl', name, '左', group, mirror(shape)));

  // 後頭部（背面）：向かって左が患者様の左
  const BACK = [
    ['shoulder', '肩上部（僧帽筋）', '首・肩', SHOULDER, true],
    ['neck', '首（後面）', '首・肩', P([78, 124], [100.5, 124], [100.5, 178], [72, 178]), true],
    ['ear', '耳', '耳', E(52, 86, 7, 14), true],
    ['top', '頭頂部', '頭', P(...hArc(hL(60), 360 + hA(60), 20)), false],
    ['occ', '後頭部', '頭', P(...hArc(hL(60), hL(108), 8), [100.5, 108], [100.5, 60]), true],
    ['nape', '後頭下部（盆の窪）', '頭', P(...hArc(hL(108), 90, 8), [100.5, 138], [100.5, 108]), true],
  ];
  BACK.forEach(([key, name, group, shape, lr]) => {
    if (!lr) { add(`hb-${key}`, 'hb', name, '', group, shape); return; }
    add(`hb-${key}-l`, 'hb', name, '左', group, shape);
    add(`hb-${key}-r`, 'hb', name, '右', group, mirror(shape));
  });

  const BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r]));
  const GROUPS = ['頭・首', '肩', '腕', '体幹', '背中・腰', '脚'];
  // 切り替えできる人体図の種類
  const SETS = {
    body: { name: '身体', views: ['f', 'b'], groups: GROUPS },
    // 頭部のチェック一覧は図ごとに並べる（同じ名前の部位が図ごとにあるため）
    head: { name: '頭部', views: ['hf', 'hr', 'hl', 'hb'], groups: ['頭', '顔', '耳', '首・肩'], byView: true },
  };
  // 図ごとの高さ・見出し・左右の表示
  const VIEWS = {
    f: { h: H, cap: '前面', sides: ['右', '左'] },
    b: { h: H, cap: '背面', sides: ['左', '右'] },
    hf: { h: 200, cap: '顔（前面）', sides: ['右', '左'] },
    hr: { h: 200, cap: '右側面', sides: null },
    hl: { h: 200, cap: '左側面', sides: null },
    hb: { h: 200, cap: '後頭部（背面）', sides: ['左', '右'] },
  };
  // 目・鼻・口・耳の内側などの飾り線（クリックの邪魔をしない）
  const mirrorPath = (d) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${W - Number(x)} ${y}`);
  const FACE_DECO = ['M76 70 Q85 66 94 70', 'M78 80 Q85 76 92 80 Q85 83 78 80', 'M50 79 Q46 86 50 95'];
  const SIDE_DECO = ['M130 71 Q138 68 145 71', 'M133 79 Q138 77 143 79', 'M140 116 L146 116', 'M91 79 Q84 88 91 98', 'M104 131 Q114 136 126 137'];
  const DECO = {
    hf: FACE_DECO.concat(FACE_DECO.map(mirrorPath), ['M100 86 L96 104 Q100 107 104 104', 'M90 113 Q100 117 110 113']),
    hr: SIDE_DECO,
    hl: SIDE_DECO.map(mirrorPath),
    hb: ['M50 79 Q46 86 50 95', mirrorPath('M50 79 Q46 86 50 95')],
  };
  const DASH = { hb: ['M58 100 Q72 126 100 132 Q128 126 142 100'] };

  // 名前は「左右＋名称」。頭部で同じ名前が別の図にもある時（耳・後頭部など）は図の名前を添える
  const VIEW_SHORT = { hf: '前面', hr: '側面', hl: '側面', hb: '後面' };
  const nameCount = {};
  REGIONS.forEach((r) => { const k = r.side + r.name; nameCount[k] = (nameCount[k] || 0) + 1; });
  const label = (r) => `${r.side}${r.name}${r.set === 'head' && nameCount[r.side + r.name] > 1 ? `（${VIEW_SHORT[r.view]}）` : ''}`;

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
   * @param {{selected: Object<string, number>, pins: Array, links: Array, linkSel: string}} st
   *   selected: 部位id → 表示番号 / pins: 鍼（赤）/ links: 電気（青）＝鍼と鍼を結ぶ線 / linkSel: 電気でつなぐ途中の鍼
   */
  function figure(view, st, opts = {}) {
    const v = VIEWS[view];
    const regs = REGIONS.filter((r) => r.view === view);
    const sil = regs.map((r) => shapeSvg(r.shape, '')).join('');
    const parts = regs.map((r) => {
      const on = st.selected[r.id] != null;
      return shapeSvg(r.shape, `class="rg${on ? ' on' : ''}" data-id="${r.id}"`);
    }).join('');
    const hasPin = new Set((st.pins || []).map((p) => p.region));
    const badges = regs.filter((r) => st.selected[r.id] != null).map((r) => {
      let [x, y] = center(r.shape);
      // 鍼が付いている部位は番号を左上にずらして、鍼の印に重ねない
      if (hasPin.has(r.id)) { x -= 9; y -= 9; }
      return `<g class="badge" pointer-events="none"><circle cx="${x}" cy="${y}" r="6.2"/><text x="${x}" y="${y + 2.6}">${st.selected[r.id]}</text></g>`;
    }).join('');
    // 鍼（赤い点）と電気（鍼と鍼を結ぶ青い線）。押しやすいように透明の大きめの当たり判定を重ねる
    const pinsHere = (st.pins || []).filter((p) => p.view === view);
    const byId = Object.fromEntries(pinsHere.map((p) => [p.id, p]));
    const links = (st.links || []).map((l, i) => ({ l, i })).filter(({ l }) => byId[l.a] && byId[l.b]).map(({ l, i }) => {
      const a = byId[l.a];
      const b = byId[l.b];
      const xy = `x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"`;
      return `<g class="link" data-link="${i}"><line class="hit" ${xy}/><line class="ln" ${xy}/></g>`;
    }).join('');
    const pins = pinsHere.map((p) =>
      `<g class="pin${st.linkSel === p.id ? ' sel' : ''}" data-pin="${p.id}"><circle class="hit" cx="${p.x}" cy="${p.y}" r="7"/><circle class="dot" cx="${p.x}" cy="${p.y}" r="3"/></g>`
    ).join('');
    const sides = v.sides ? `<text class="side" x="40" y="-3">${v.sides[0]}</text><text class="side" x="${W - 40}" y="-3">${v.sides[1]}</text>` : '';
    const deco = (DECO[view] || []).map((d) => `<path d="${d}"/>`).join('') +
      (DASH[view] || []).map((d) => `<path d="${d}" stroke-dasharray="3 3"/>`).join('');
    return `<svg class="body-svg${opts.cls ? ' ' + opts.cls : ''}" viewBox="0 -14 ${W} ${v.h + 14}" data-view="${view}" xmlns="http://www.w3.org/2000/svg">
      <text class="cap" x="${W / 2}" y="-3">${v.cap}</text>${sides}
      <g class="sil">${sil}</g><g class="parts">${parts}</g><g class="deco" pointer-events="none">${deco}</g>${badges}${links}${pins}
    </svg>`;
  }


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

  window.Body = { REGIONS, BY_ID, GROUPS, SETS, VIEWS, figure, label, regionAt, esc };
})();
