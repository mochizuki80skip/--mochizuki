/* ログインしていない人には見せない（カルテ枚数計算など、鍼施術内容書以外のページ用）
 * サーバー（api.php）が無い場所で直接開いた時は、そのまま使える。
 */
(function () {
  'use strict';
  const root = document.documentElement;
  root.style.visibility = 'hidden';
  const show = () => { root.style.visibility = ''; };
  const page = location.pathname.split('/').pop() || '';
  fetch('api.php?a=me', { credentials: 'same-origin', cache: 'no-store', headers: { 'X-Shinq': '1' } })
    .then((res) => res.json().then((d) => ({ res, d }), () => ({ res, d: null })))
    .then(({ res, d }) => {
      if (!d) { show(); return; }                    // api.php が動いていない（端末内だけで使う）
      if (res.ok && d.loggedIn) { show(); return; }  // ログイン済み
      // 未ログイン（または設定の不備）→ ログイン画面へ。ログイン後にこのページへ戻る
      location.replace(`./?next=${encodeURIComponent(page)}`);
    })
    .catch(show);
})();
