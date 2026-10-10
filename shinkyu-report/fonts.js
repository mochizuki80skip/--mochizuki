/* 文字のフォント（画面・内容書・カルテ枚数計算で共通）
 * 候補は「𠮷」と人名によく使う 髙・﨑・德・濵・邉 と「鍼」がすべて表示できることを確認したものだけ。
 * Google Fonts から読み込む（必要な文字の分だけ自動で取得される）。読み込めない時は端末のフォントで表示。
 */
(function () {
  'use strict';

  const CHOICES = [
    { key: 'noto-sans', family: 'Noto Sans JP', label: 'Noto Sans JP（ゴシック）', axis: 'wght@400;700', fallback: 'sans-serif',
      note: '見やすく癖のないゴシック体。おすすめ' },
    { key: 'noto-serif', family: 'Noto Serif JP', label: 'Noto Serif JP（明朝）', axis: 'wght@400;700', fallback: 'serif',
      note: '書類らしい明朝体' },
    { key: 'shippori-mincho', family: 'Shippori Mincho', label: 'しっぽり明朝', axis: 'wght@400;700', fallback: 'serif',
      note: 'やわらかい印象の明朝体' },
    { key: 'klee', family: 'Klee One', label: 'Klee One（教科書体）', axis: 'wght@400;600', fallback: 'serif',
      note: '手書きに近い、親しみのある書体' },
    { key: 'shippori-antique', family: 'Shippori Antique', label: 'しっぽりアンチック', axis: '', fallback: 'sans-serif',
      note: '丸みのある見出し向けの書体（太字なし）' },
  ];
  const DEFAULT = 'noto-sans';
  const SAMPLE = '𠮷田 髙子 様　鍼施術内容書 2026/10/17';

  const find = (key) => CHOICES.find((c) => c.key === key) || CHOICES.find((c) => c.key === DEFAULT);
  const cssUrl = (c, text) => `https://fonts.googleapis.com/css2?family=${encodeURIComponent(c.family)}` +
    `${c.axis ? ':' + c.axis : ''}&display=swap${text ? '&text=' + encodeURIComponent(text) : ''}`;

  function link(id, href) {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('link');
      el.id = id;
      el.rel = 'stylesheet';
      document.head.appendChild(el);
    }
    if (el.getAttribute('href') !== href) el.setAttribute('href', href);
  }

  // 選んだフォントを画面全体（入力・内容書・SVG の文字）に使う
  function apply(key) {
    const c = find(key);
    link('font-css', cssUrl(c));
    document.documentElement.style.setProperty('--font', `"${c.family}", ${c.fallback}`);
    return c;
  }

  // 設定画面の見本用：候補ごとに見本の文字だけを読み込む（軽い）
  function loadSamples() {
    CHOICES.forEach((c) => link(`font-sample-${c.key}`, cssUrl(c, SAMPLE)));
  }

  // フォントの読み込みを待つ（内容書の文字サイズ調整・印刷の前に使う）。最大 3 秒
  function ready() {
    if (!document.fonts || !document.fonts.ready) return Promise.resolve();
    return Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 3000))]);
  }

  // 保存されている設定のフォントをすぐ使う（画面が出る前にちらつかないように）
  let saved = DEFAULT;
  try { saved = (JSON.parse(localStorage.getItem('shinq:settings')) || {}).font || DEFAULT; } catch { /* 既定のまま */ }
  apply(saved);

  window.Fonts = { CHOICES, DEFAULT, SAMPLE, apply, loadSamples, ready, find };
})();
