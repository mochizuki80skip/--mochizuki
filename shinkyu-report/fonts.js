/* 文字のフォント（画面・内容書・カルテ枚数計算で共通）：Noto Sans JP に統一
 * 「𠮷」と人名によく使う 髙・﨑・德・濵・邉 と「鍼」がすべて表示できることを確認済み。
 * Google Fonts から読み込む（必要な文字の分だけ自動で取得される）。読み込めない時は端末のフォントで表示。
 */
(function () {
  'use strict';

  const FAMILY = 'Noto Sans JP';
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap';
  document.head.appendChild(link);
  document.documentElement.style.setProperty('--font', `"${FAMILY}", sans-serif`);

  // フォントの読み込みを待つ（内容書の文字サイズ調整・印刷の前に使う）。最大 3 秒
  function ready() {
    if (!document.fonts || !document.fonts.ready) return Promise.resolve();
    return Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 3000))]);
  }

  window.Fonts = { FAMILY, ready };
})();
