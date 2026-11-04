/*
 * リンク先の設定
 * --------------------------------------------------
 * 申し込み先やカレンダーを変えるときは、このファイルの値だけを書き換えて
 * サーバーに上書きアップロードしてください（index.html は触らなくてOK）。
 *
 *   line          … 「LINEで申し込む」ボタンのURL（全5か所）
 *   tel           … 電話番号（ハイフンありで。全6か所のボタンと番号表示に反映）
 *   calendarPage  … 「カレンダーを大きく開く」ボタンのURL
 *   calendarEmbed … ページ内に表示する空き状況カレンダーの埋め込みURL
 *                   （Canvaの「共有」→「埋め込み」で出るURL）
 */
var LP_SETTINGS = {
  line: 'https://lin.ee/sQYoyZ5',
  tel: '054-207-7007',
  calendarPage: 'https://80skip.my.canva.site/dag7q4yfv80',
  calendarEmbed: 'https://www.canva.com/design/DAG7q4YFV80/8zEehBEGzSh-W5UGY1Hxzw/view?embed'
};

/* ここから下は変更不要です */
(function (s) {
  function each(sel, fn) {
    Array.prototype.forEach.call(document.querySelectorAll(sel), fn);
  }
  if (s.line) each('[data-link="line"]', function (a) { a.href = s.line; });
  if (s.tel) {
    each('[data-link="tel"]', function (a) { a.href = 'tel:' + s.tel.replace(/[^\d+]/g, ''); });
    each('[data-tel-text]', function (a) { a.textContent = s.tel; });
  }
  if (s.calendarPage) each('[data-link="calendar-page"]', function (a) { a.href = s.calendarPage; });
  if (s.calendarEmbed) each('[data-link="calendar-embed"]', function (f) {
    if (f.getAttribute('src') !== s.calendarEmbed) f.src = s.calendarEmbed;
  });
})(LP_SETTINGS);
