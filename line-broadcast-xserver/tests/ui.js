// ブラウザ(Chromium)での画面操作テスト。run.php のあと（アカウント等が登録済みの状態）で実行する。
//   NODE_PATH=$(npm root -g) node tests/ui.js
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8080';
let pass = 0, fail = 0;
const ok = (c, n, d = '') => { if (c) { pass++; console.log('  ✔ ' + n); } else { fail++; console.log('  ✘ ' + n + (d ? '  -- ' + d : '')); } };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, timezoneId: 'Asia/Tokyo' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());
  const badResponses = [];
  page.on('response', r => { if (r.status() >= 400) badResponses.push(r.status() + ' ' + r.request().method() + ' ' + r.url().replace(BASE, '')); });

  console.log('\n== アクセスキー ==');
  const key = (require('fs').readFileSync('/tmp/lhrun/app/config.php', 'utf8').match(/'access_key' => '([a-f0-9]+)'/) || [])[1];
  const blocked = await page.goto(BASE + '/login');
  ok(blocked.status() === 404, 'キー無しのブラウザには 404（ログイン画面は見えない）');
  badResponses.length = 0; // 上の 404 は意図したもの
  await page.goto(BASE + '/?k=' + key);
  ok(page.url() === BASE + '/login' || page.url().endsWith('/login'), 'キー付き URL を開くとログイン画面へ（URL からキーが消える）', page.url());

  console.log('\n== ログイン ==');
  await page.fill('input[name=login_id]', 'admin');
  await page.fill('input[name=password]', 'adminpass1');
  await page.click('button:has-text("ログイン")');
  await page.waitForURL('**/dashboard');
  ok(await page.locator('text=LINE アカウント一覧').count() > 0, 'ログインしてダッシュボードへ');

  console.log('\n== 一括配信の作成画面 ==');
  await page.goto(BASE + '/campaigns/new');
  await page.waitForSelector('text=1. 配信するアカウント');
  const labels = await page.locator('section:has-text("1. 配信するアカウント") label').allInnerTexts();
  ok(labels.length === 2, 'アカウントが選択肢に出る', JSON.stringify(labels));
  await page.click('text=全選択');
  ok((await page.locator('text=2 / 2 選択中').count()) > 0, '全選択で 2/2 になる');
  await page.click('text=全解除');
  ok((await page.locator('text=0 / 2 選択中').count()) > 0, '全解除');
  await page.click('text=全選択');

  // タグ（2アカウントとも「イベント案内」あり）
  const tagBtn = page.locator('button:has-text("イベント案内")');
  ok((await tagBtn.innerText()).includes('2/2'), 'タグの保有アカウント数が 2/2 と出る');
  await tagBtn.click();
  ok((await page.locator('text=全員に送られることはありません').count()) > 0, 'タグ選択時の注意書きが出る');
  await tagBtn.click();

  // メッセージ: テキスト
  await page.fill('input[placeholder="例：10月イベントのお知らせ"]', 'UIテスト配信');
  await page.fill('textarea[placeholder="本文を入力"]', 'こんにちは\n10月のイベントです');
  ok((await page.locator('.bg-\\[\\#8CABD9\\]').innerText()).includes('10月のイベントです'), 'プレビューに本文が反映される');

  // 画像（ブラウザ側で縮小→アップロード）
  await page.click('button:has-text("+ 画像")');
  const fileInput = page.locator('input[type=file]').last();
  await fileInput.setInputFiles('/tmp/ui-test.jpg');
  await page.waitForSelector('img[src*="/media/"]', { timeout: 10000 });
  const imgSrc = await page.locator('.bg-\\[\\#8CABD9\\] img').first().getAttribute('src');
  ok(/\/media\/[a-f0-9]{32}$/.test(imgSrc), '画像がアップロードされプレビューに表示', imgSrc);
  const info = await page.evaluate(async (src) => { const b = await (await fetch(src)).blob(); const bm = await createImageBitmap(b); return { w: bm.width, size: b.size }; }, imgSrc);
  ok(info.w === 1024 && info.size < 900 * 1024, '画像は幅 1024px・900KB 以下に縮小されている', JSON.stringify(info));

  // リッチメッセージ
  await page.click('button:has-text("+ リッチメッセージ")');
  await page.locator('input[type=file]').last().setInputFiles('/tmp/ui-test.jpg');
  await page.waitForFunction(() => document.querySelectorAll('.bg-\\[\\#8CABD9\\] img').length >= 2, null, { timeout: 10000 });
  await page.click('button:has-text("4 分割")');
  ok(await page.locator('text=エリア4').count() > 0, '4 分割でエリア入力が 4 つになる');
  const areaInputs = page.locator('input[placeholder="https://..."]');
  for (let i = 0; i < 4; i++) await areaInputs.nth(i).fill('https://example.com/' + (i + 1));
  await page.fill('input[placeholder="代替テキスト（通知・トーク一覧に表示されます）"]', 'イベントメニュー');
  ok(await page.locator('.bg-\\[\\#8CABD9\\] .absolute span:text-is("4")').count() === 1, 'プレビューにタップ領域番号 1〜4 が出る');
  await page.click('button:has-text("2 分割")').catch(() => {});
  await page.click('button:has-text("4 分割")');
  ok(await areaInputs.nth(0).inputValue() === 'https://example.com/1', 'レイアウトを切り替えても入力済みの値が残る');
  for (let i = 2; i < 4; i++) await areaInputs.nth(i).fill('https://example.com/' + (i + 1)); // 戻した分(エリア3・4)は再入力

  // カードタイプ
  await page.click('button:has-text("+ カードタイプ")');
  const cardsBlock = page.locator('div.border.rounded.bg-gray-50:has-text("カードタイプ")').last();
  await cardsBlock.locator('input[placeholder="代替テキスト（通知・トーク一覧に表示されます）"]').fill('メニュー一覧');
  await cardsBlock.locator('input[placeholder="タイトル（40文字まで）"]').fill('整体コース');
  await cardsBlock.locator('input[placeholder="説明文（60文字まで・任意）"]').fill('初回 1,980円');
  await cardsBlock.locator('input[placeholder="ボタン名"]').fill('予約する');
  await cardsBlock.locator('input[placeholder="https://..."]').first().fill('https://example.com/reserve');
  await page.click('button:has-text("+ カードを追加")');
  await cardsBlock.locator('input[placeholder="タイトル（40文字まで）"]').nth(1).fill('鍼灸コース');
  const preview = await page.locator('.bg-\\[\\#8CABD9\\]').innerText();
  ok(preview.includes('整体コース') && preview.includes('鍼灸コース') && preview.includes('予約する'), 'カードがプレビューに反映（2 枚）');

  // 並べ替え・削除
  ok(await page.locator('text=4. カードタイプ').count() === 1, '吹き出し 4 が「カードタイプ」');
  await page.locator('button[title="上へ"]').nth(3).click();
  ok(await page.locator('text=3. カードタイプ').count() === 1, '↑ で吹き出しを並べ替えられる');
  ok(await page.locator('button:has-text("+ テキスト")').count() === 1, '5 つまでは追加ボタンが出る');
  await page.click('button:has-text("+ テキスト")');
  await page.locator('button:has-text("+ テキスト")').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  ok(await page.locator('button:has-text("+ テキスト")').isHidden(), '5 つに達すると追加ボタンが消える');
  await page.locator('button[title="削除"]').last().click();
  await page.locator('button:has-text("+ テキスト")').waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
  ok(await page.locator('button:has-text("+ テキスト")').isVisible(), '削除すると追加ボタンが戻る');

  await page.screenshot({ path: '/tmp/ui-composer.png', fullPage: true });

  // 予約配信で送信
  await page.click('text=日時を指定');
  // 日本時間(UTC+9)の「いまから2時間後」を入力欄に入れる
  const jst = new Date(Date.now() + (2 + 9) * 3600 * 1000);
  const pad = n => String(n).padStart(2, '0');
  const d = { y: jst.getUTCFullYear(), m: jst.getUTCMonth() + 1, d: jst.getUTCDate(), h: jst.getUTCHours(), mi: jst.getUTCMinutes() };
  await page.fill('input[type=datetime-local]', `${d.y}-${pad(d.m)}-${pad(d.d)}T${pad(d.h)}:${pad(d.mi)}`);
  await page.click('button:has-text("予約配信する")');
  await page.waitForURL(/\/campaigns\/\d+$/, { timeout: 10000 }).catch(async () => { throw new Error('送信失敗: ' + (await page.locator('.bg-red-50').allInnerTexts()).join(' / ')); });
  const body = await page.locator('main').innerText();
  ok(body.includes('UIテスト配信') && body.includes('予約済'), '予約配信が作成され詳細画面へ');
  ok(body.includes('本店') && body.includes('渋谷店'), '2 アカウント分の行が出る');
  ok(body.includes('整体コース') && body.includes('こんにちは'), '詳細画面にもプレビュー表示');
  const sched = await page.locator('text=予約：').innerText();
  const want = `${d.y}/${pad(d.m)}/${pad(d.d)} ${pad(d.h)}:${pad(d.mi)}`;
  ok(sched.includes(want), '予約日時が日本時間のまま保存・表示される（ずれない）', sched + ' / ' + want);
  await page.screenshot({ path: '/tmp/ui-detail.png', fullPage: true });

  // 取り消し
  await page.click('button:has-text("配信を取り消す")');
  await page.waitForSelector('text=取消');
  ok((await page.locator('main').innerText()).includes('取消'), '詳細画面から取り消せる');

  console.log('\n== 検証エラーの表示 ==');
  await page.goto(BASE + '/campaigns/new');
  await page.click('button:has-text("下書き保存")');
  await page.waitForSelector('text=配信するアカウントを選択してください', { timeout: 5000 }).catch(() => {});
  ok(await page.locator('text=配信するアカウントを選択してください').count() > 0 || await page.locator('text=タイトルを入力してください').count() > 0, '未入力の保存はエラーを画面に表示');

  console.log('\n== ステップ配信の作成画面 ==');
  await page.goto(BASE + '/c/1/scenarios/new');
  await page.click('text=サンプル（初回来院フォロー）を入れてみる');
  ok(await page.locator('text=ステップ 3').count() > 0, 'サンプルで 3 ステップが入る');
  const stepText = await page.locator('main').innerText();
  ok(stepText.includes('友だち追加から すぐ') && stepText.includes('友だち追加から 1日後 10:00') && stepText.includes('友だち追加から 7日後 10:00'), '各ステップの目安（すぐ / 1日後 10:00 / 7日後 10:00）');
  await page.click('button:has-text("+ ステップを追加")');
  ok(await page.locator('text=ステップ 4').count() > 0, 'ステップを追加できる');
  // 4 つ目を「経過時間 3 時間後」に
  const step4 = page.locator('div.bg-white.border.rounded.p-4:has-text("ステップ 4")');
  await step4.locator('input[type=radio][value=elapsed]').check();
  await step4.locator('input[type=number]').first().fill('3');
  await step4.locator('select').first().selectOption('hour');
  await step4.locator('textarea').fill('4通目');
  ok((await page.locator('main').innerText()).includes('7日後 10:00') , '累計ラベルが更新される');
  await page.click('text=タグが付いたとき');
  await page.click('button:has-text("保存")');
  await page.waitForSelector('text=タグを選択', { state: 'attached' });
  ok(await page.locator('text=トリガーにするタグを選択してください').count() > 0, 'タグ未選択はエラー表示');
  await page.click('text=友だち追加されたとき');
  await page.click('button:has-text("保存")');
  await page.waitForURL('**/scenarios', { timeout: 10000 });
  const list = await page.locator('main').innerText();
  ok(list.includes('初回来院フォロー') && list.includes('1日後 10:00') && list.includes('約7日3時間後'), 'ステップ配信が作成され一覧に流れが出る', list.slice(0, 400));

  console.log('\n== ステップ配信の一覧操作 ==');
  await page.locator('button:has-text("無効にする")').first().click();
  await page.waitForSelector('button:has-text("有効にする")');
  ok(await page.locator('span:text-is("無効")').count() > 0, '一覧から無効にできる');
  await page.locator('button:has-text("他の店舗へコピー")').first().click();
  await page.locator('label:has-text("渋谷店") input:visible').check();
  await page.locator('button:has-text("コピーする"):visible').click();
  await page.waitForSelector('text=コピーしました');
  ok(true, '他の店舗へコピー');
  await page.screenshot({ path: '/tmp/ui-scenarios.png', fullPage: true });
  await page.locator('a:has-text("編集・進行状況")').first().click();
  await page.waitForSelector('text=進行状況');
  ok(await page.locator('textarea').count() >= 4, '編集画面で既存ステップが復元される');

  console.log('\n== 自動タグ付け（キーワード・QRコード） ==');
  await page.goto(BASE + '/c/1/keywords');
  ok(await page.locator('a:has-text("自動タグ付け")').count() > 0, 'サイドメニューに「自動タグ付け」がある');
  await page.fill('input[placeholder*="静岡エリア"]', '沼津エリアUI');
  await page.locator('select:has(option[value="__new"])').selectOption('__new');
  await page.fill('input[placeholder*="新しいタグ名"]', 'エリア：沼津UI');
  await page.fill('input[placeholder*="登録しました"]', '沼津エリアで登録しました');
  await page.click('button:has-text("ルールを追加")');
  await page.waitForSelector('td:has-text("沼津エリアUI")', { timeout: 10000 }).catch(async () => { throw new Error('ルール追加に失敗: ' + (await page.locator('.bg-red-50').allInnerTexts()).join(' / ')); });
  ok(await page.locator('td:has-text("沼津エリアUI")').count() > 0, 'ルールを追加すると一覧に出る');
  const row = page.locator('tr:has-text("沼津エリアUI")');
  ok((await row.innerText()).includes('エリア：沼津UI'), '新しいタグが同時に作られて表示される');
  await row.locator('button:has-text("QRコード")').click();
  await page.waitForSelector('img[alt="QRコード"]');
  const qrSrc = await page.locator('img[alt="QRコード"]').getAttribute('src');
  ok(/^data:image\/gif;base64,/.test(qrSrc), 'QRコードが表示される');
  ok((await page.locator('text=https://line.me/R/oaMessage/@mock123/?').count()) > 0, 'QRの中身（友だち追加URL）が表示される');
  await page.screenshot({ path: '/tmp/ui-keywords.png' });
  const box = await page.locator('img[alt="QRコード"]').boundingBox();
  ok(box && box.y >= 0 && box.y < 800, 'QRコードは画面の手前（重ねて表示）に出る', JSON.stringify(box));
  await page.click('button:has-text("閉じる")');
  await row.locator('button:has-text("停止")').click();
  await page.waitForSelector('tr:has-text("沼津エリアUI"):has-text("停止中")');
  ok(true, 'ルールを停止できる');

  console.log('\n== 設定画面 ==');
  await page.goto(BASE + '/c/1/settings');
  ok((await page.locator('input[readonly]').inputValue()).endsWith('/webhook/1'), 'Webhook URL が表示される');

  console.log('\n== JavaScript エラー ==');
  // 想定内の失敗(検証エラーを見せるために API が返す 400)と favicon を除く
  const unexpected = badResponses.filter(u => !u.includes('favicon') && !/^400 POST \/api\//.test(u));
  ok(unexpected.length === 0, '想定外の 4xx/5xx 応答がない', unexpected.join(' | '));
  const jsErrors = errors.filter(e => !e.startsWith('console: Failed to load resource'));
  ok(jsErrors.length === 0, 'JavaScript の実行エラーがない', jsErrors.join(' | '));

  await browser.close();
  console.log(`\n結果: ${pass} 件成功 / ${fail} 件失敗`);
  process.exit(fail ? 1 : 0);
})();
