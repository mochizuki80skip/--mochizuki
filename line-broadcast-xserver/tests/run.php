<?php
declare(strict_types=1);
// 結合テスト: tests/setup.sh でサーバーを起動してから `php tests/run.php` を実行する。
const BASE = 'http://127.0.0.1:8080';
const RUN = '/tmp/lhrun';
$pass = 0; $fail = 0;
function ok(bool $cond, string $name, string $detail = ''): void {
    global $pass, $fail;
    if ($cond) { $pass++; echo "  ✔ $name\n"; } else { $fail++; echo "  ✘ $name" . ($detail !== '' ? "  -- $detail" : '') . "\n"; }
}
function section(string $s): void { echo "\n== $s ==\n"; }

$GATE_KEY = null; // インストール後に config.php から読む（入口のアクセスキー）
class Http {
    public string $jar;
    public ?string $csrf = null;
    public function __construct(bool $unlocked = true) { $this->jar = tempnam(sys_get_temp_dir(), 'jar'); if ($unlocked && $GLOBALS['GATE_KEY']) $this->unlock(); }
    /** アクセスキー付き URL を開いて、この端末(Cookie)を通行可能にする */
    public function unlock(): void { $this->req('GET', '/?k=' . $GLOBALS['GATE_KEY']); }
    public function req(string $method, string $path, array|string|null $body = null, array $headers = [], bool $follow = false): array {
        $ch = curl_init(str_starts_with($path, 'http') ? $path : BASE . $path);
        curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_HEADER => true, CURLOPT_FOLLOWLOCATION => $follow,
            CURLOPT_COOKIEJAR => $this->jar, CURLOPT_COOKIEFILE => $this->jar]);
        if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        $raw = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $hs = (int)curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        curl_close($ch);
        return ['status' => $status, 'headers' => substr((string)$raw, 0, $hs), 'body' => substr((string)$raw, $hs)];
    }
    public function page(string $path): array {
        $r = $this->req('GET', $path, null, [], true);
        if (preg_match('/name="csrf-token" content="([^"]+)"/', $r['body'], $m) || preg_match('/name="_csrf" value="([^"]+)"/', $r['body'], $m)) $this->csrf = $m[1];
        return $r;
    }
    public function api(string $path, array $data = [], bool $csrf = true): array {
        $h = ['Content-Type: application/json'];
        if ($csrf && $this->csrf) $h[] = 'X-CSRF-Token: ' . $this->csrf;
        $r = $this->req('POST', $path, json_encode($data), $h);
        $r['json'] = json_decode($r['body'], true);
        return $r;
    }
    public function form(string $path, array $data = []): array {
        $data['_csrf'] = $this->csrf;
        return $this->req('POST', $path, http_build_query($data));
    }
}

function db(): PDO { static $p; return $p ??= new PDO('mysql:host=localhost;dbname=linehub;charset=utf8mb4', 'lh', 'lhpass', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]); }
function q(string $sql, array $p = []): array { $s = db()->prepare($sql); $s->execute($p); return $s->fetchAll(); }
function val(string $sql, array $p = []): mixed { $s = db()->prepare($sql); $s->execute($p); $v = $s->fetchColumn(); return $v === false ? null : $v; }
function mockLog(): array { $f = RUN . '/tests/mock_line.log'; return is_file($f) ? array_map(fn($l) => json_decode($l, true), array_filter(explode("\n", (string)file_get_contents($f)))) : []; }
function cron(): string { return (string)shell_exec('php ' . RUN . '/app/cron.php 2>&1'); }
function webhook(Http $h, int $channelId, string $secret, array $events, ?string $sigOverride = null): array {
    $body = json_encode(['destination' => 'Ubot', 'events' => $events]);
    $sig = $sigOverride ?? base64_encode(hash_hmac('sha256', $body, $secret, true));
    return $h->req('POST', "/webhook/$channelId", $body, ['Content-Type: application/json', 'X-Line-Signature: ' . $sig]);
}
function tinyJpeg(): string { $im = imagecreatetruecolor(300, 150); imagefill($im, 0, 0, imagecolorallocate($im, 10, 150, 90)); ob_start(); imagejpeg($im); return (string)ob_get_clean(); }
function upload(Http $h, string $bytes, string $name = 'a.jpg', string $type = 'image/jpeg'): array {
    $tmp = tempnam(sys_get_temp_dir(), 'up'); file_put_contents($tmp, $bytes);
    $ch = curl_init(BASE . '/api/media');
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_COOKIEJAR => $h->jar, CURLOPT_COOKIEFILE => $h->jar,
        CURLOPT_HTTPHEADER => ['X-CSRF-Token: ' . $h->csrf], CURLOPT_POSTFIELDS => ['file' => new CURLFile($tmp, $type, $name)]]);
    $raw = curl_exec($ch); $st = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    return ['status' => $st, 'json' => json_decode((string)$raw, true)];
}

// ============================================================
section('インストーラー');
$admin = new Http();
$r = $admin->req('GET', '/', null, [], true);
ok(str_contains($r['body'], 'セットアップ'), '未設定ならインストーラーに誘導される');
ok(str_contains($r['body'], '✔ PHP 8.1 以上'), '動作環境チェックが表示される');
$r = $admin->req('POST', '/install.php', http_build_query(['db_host' => 'localhost', 'db_name' => 'linehub', 'db_user' => 'lh', 'db_pass' => 'wrong', 'base_url' => BASE, 'login_id' => 'admin', 'password' => 'adminpass1']));
ok(str_contains($r['body'], '失敗しました'), 'DB 接続エラーを画面に表示する');
$r = $admin->req('POST', '/install.php', http_build_query(['db_host' => 'localhost', 'db_name' => 'linehub', 'db_user' => 'lh', 'db_pass' => 'lhpass', 'base_url' => BASE, 'login_id' => 'admin', 'password' => 'short']));
ok(str_contains($r['body'], '8 文字以上'), '短い管理者パスワードは拒否');
$r = $admin->req('POST', '/install.php', http_build_query(['db_host' => 'localhost', 'db_name' => 'linehub', 'db_user' => 'lh', 'db_pass' => 'lhpass', 'base_url' => BASE, 'login_id' => 'a b', 'password' => 'adminpass1']));
ok(str_contains($r['body'], 'ログインID'), '空白を含むログインIDは拒否');
$r = $admin->req('POST', '/install.php', http_build_query(['db_host' => 'localhost', 'db_name' => 'linehub', 'db_user' => 'lh', 'db_pass' => 'lhpass', 'base_url' => BASE, 'login_id' => 'ab', 'password' => 'adminpass1']));
ok(str_contains($r['body'], 'ログインID'), '短すぎるログインID(2文字)は拒否');
$r = $admin->req('POST', '/install.php', http_build_query(['db_host' => 'localhost', 'db_name' => 'linehub', 'db_user' => 'lh', 'db_pass' => 'lhpass', 'base_url' => BASE, 'login_id' => 'admin', 'password' => 'adminpass1']));
ok(str_contains($r['body'], 'セットアップが完了'), 'インストール成功');
ok(is_file(RUN . '/app/config.php') && !is_file(RUN . '/public/install.php'), 'config.php 作成・install.php 自己削除');
ok(count(q('SHOW TABLES')) >= 14, 'テーブルが作成された', (string)count(q('SHOW TABLES')));
// テスト用に LINE API をモックへ向ける
$cfg = file_get_contents(RUN . '/app/config.php');
file_put_contents(RUN . '/app/config.php', str_replace("'https://api.line.me'", "'http://127.0.0.1:9001'", $cfg));
$r = $admin->req('GET', '/install.php');
ok($r['status'] === 404 || !str_contains($r['body'], '接続情報'), 'install.php は再実行できない');
preg_match("/'access_key' => '([a-f0-9]{32})'/", (string)file_get_contents(RUN . '/app/config.php'), $mk);
$GATE_KEY = $mk[1] ?? null;
ok($GATE_KEY !== null, 'アクセスキーが自動生成される');


section('入口のアクセスキー（URL を知っている人だけ）');
$stranger = new Http(false); // アクセスキーを知らない人
foreach (['/', '/login', '/dashboard', '/campaigns', '/channels', '/api/campaigns', '/c/1'] as $path) {
    $r = $stranger->req('GET', $path);
    ok($r['status'] === 404 && str_contains($r['body'], 'Not Found') && !str_contains($r['body'], 'LINE'), "キー無しで GET $path → 404（存在しないサイトに見える）", (string)$r['status']);
}
ok($stranger->req('POST', '/login', http_build_query(['login_id' => 'admin', 'password' => 'adminpass1']))['status'] === 404, 'キー無しではログイン POST も 404');
ok($stranger->req('GET', '/?k=wrongkey')['status'] === 404, '誤ったキーは 404');
ok(str_contains($stranger->req('GET', '/login')['headers'], 'X-Robots-Tag: noindex') || str_contains($stranger->req('GET', '/login')['headers'], 'x-robots-tag: noindex'), '404 応答にも noindex ヘッダ');
ok($stranger->req('GET', '/robots.txt')['body'] === "User-agent: *\nDisallow: /\n", 'robots.txt は全拒否');
$r = $stranger->req('POST', '/webhook/1', '{}', ['X-Line-Signature: x']);
ok(str_contains($r['body'], 'channel not found'), 'LINE の Webhook はキー無しでもアプリまで届く（認証は署名検証）', $r['body']);
$r = $stranger->req('GET', '/?k=' . $GATE_KEY);
ok($r['status'] === 302 && str_contains($r['headers'], 'Set-Cookie: lhgate=') && !str_contains($r['headers'], 'Location: /?k='), '正しいキー → 通行証 Cookie を発行してキーを消した URL へ');
ok(str_contains($r['headers'], 'HttpOnly') && str_contains($r['headers'], 'SameSite=Lax'), '通行証 Cookie は HttpOnly / SameSite=Lax');
ok(str_contains($stranger->req('GET', '/login', null, [], true)['body'], 'ログイン'), '通行証のある端末はログイン画面を見られる');
$admin->unlock();

// ============================================================
section('ログイン・CSRF');
$r = $admin->page('/login');
ok($r['status'] === 200 && str_contains($r['body'], 'ログイン'), 'ログイン画面');
$r = $admin->form('/login', ['login_id' => 'admin', 'password' => 'nope']);
ok($r['status'] === 401 && str_contains($r['body'], 'ログインIDまたはパスワードが違います'), '誤ったパスワードは拒否');
$r = $admin->form('/login', ['login_id' => 'nobody', 'password' => 'adminpass1']);
ok($r['status'] === 401 && str_contains($r['body'], 'ログインIDまたはパスワードが違います'), '存在しないログインIDも同じメッセージで拒否（ID の存在を教えない）');
$r = $admin->req('POST', '/login', http_build_query(['login_id' => 'admin', 'password' => 'adminpass1']));
ok($r['status'] === 419, 'CSRF トークン無しの POST は 419');
$admin->page('/login');
$r = $admin->form('/login', ['login_id' => 'admin', 'password' => 'adminpass1']);
ok($r['status'] === 302 && str_contains($r['headers'], '/dashboard'), 'ログイン成功');
$r = $admin->page('/dashboard');
ok(str_contains($r['body'], 'LINE アカウント一覧'), 'ダッシュボード表示');
ok(str_contains($r['body'], '定期実行（cron）が動いていません'), 'cron 未実行の警告が出る');
$anon = new Http();
$r = $anon->req('GET', '/campaigns');
ok($r['status'] === 302 && str_contains($r['headers'], '/login'), '未ログインはログインへ');
$anon->page('/login');
$r = $anon->api('/api/campaigns', []);
ok($r['status'] === 401, '未ログインの API は 401');
$r = $anon->api('/api/campaigns', [], false);
ok($r['status'] === 419, 'CSRF トークン無しの API は 419');
// ブルートフォース対策
$bf = new Http(); $bf->page('/login');
for ($i = 0; $i < 11; $i++) $r = $bf->form('/login', ['login_id' => 'x-user', 'password' => 'bad']);
ok(str_contains($r['body'], '多すぎます'), 'ログイン失敗が続くとブロックされる');
db()->exec('DELETE FROM login_attempts');

// ============================================================
section('LINE アカウント登録（認証情報の検証・暗号化）');
$admin->page('/channels/new');
$r = $admin->api('/api/channels', ['name' => '本店', 'accessToken' => 'BAD_TOKEN_123456', 'channelSecret' => 'secretsecret1']);
ok($r['status'] === 400 && str_contains($r['json']['error'], '接続に失敗'), '不正なトークンは登録できない');
$secrets = ['A' => 'secret-A-1234567890', 'B' => 'secret-B-1234567890', 'C' => 'secret-C-1234567890'];
$ids = [];
foreach (['A' => '本店', 'B' => '渋谷店', 'C' => '新宿店'] as $k => $name) {
    $r = $admin->api('/api/channels', ['name' => $name, 'accessToken' => "TOKEN_$k" . '_abcdefghij', 'channelSecret' => $secrets[$k], 'color' => '#06C755']);
    ok($r['status'] === 200 && $r['json']['ok'], "アカウント $name を登録");
    $ids[$k] = (int)$r['json']['id'];
}
$row = q('SELECT access_token, channel_secret FROM line_channels WHERE id = ?', [$ids['A']])[0];
ok(!str_contains($row['access_token'], 'TOKEN_A') && str_starts_with($row['access_token'], 'v1:'), 'アクセストークンは暗号化して保存');
ok(!str_contains($row['channel_secret'], 'secret-A'), 'チャネルシークレットも暗号化して保存');
$r = $admin->page("/c/{$ids['A']}/settings");
ok(str_contains($r['body'], "/webhook/{$ids['A']}"), '設定画面に Webhook URL が表示される');

// ============================================================
section('Webhook（友だち同期）');
$r = webhook($admin, $ids['A'], $secrets['A'], [], 'invalid');
ok($r['status'] === 401, '署名が不正なら 401');
$r = webhook($admin, $ids['A'], $secrets['B'], []);
ok($r['status'] === 401, '別アカウントのシークレットで署名すると 401');
$r = webhook($admin, 99999, 'x', []);
ok($r['status'] === 404, '存在しないアカウントは 404');
$r = webhook($admin, $ids['A'], $secrets['A'], []);
ok($r['status'] === 200, 'LINE の「検証」(events 空) は成功');
$fol = fn($u) => ['type' => 'follow', 'source' => ['type' => 'user', 'userId' => $u]];
$r = webhook($admin, $ids['A'], $secrets['A'], [$fol('Ua0001'), $fol('Ua0002'), $fol('Ufail0003')]);
webhook($admin, $ids['B'], $secrets['B'], [$fol('Ub0001'), $fol('Ub0002')]);
webhook($admin, $ids['C'], $secrets['C'], [$fol('Uc0001')]);
ok((int)val('SELECT COUNT(*) FROM friends WHERE channel_id = ?', [$ids['A']]) === 3, 'follow で友だちが登録される');
ok(str_contains((string)val('SELECT display_name FROM friends WHERE line_user_id = "Ua0001"'), 'テスト太郎'), 'プロフィールが取得される');
webhook($admin, $ids['A'], $secrets['A'], [['type' => 'follow', 'source' => ['type' => 'user', 'userId' => 'Ua0001']]]);
ok((int)val('SELECT COUNT(*) FROM friends WHERE line_user_id = "Ua0001"') === 1, '再 follow しても重複しない');
webhook($admin, $ids['B'], $secrets['B'], [['type' => 'unfollow', 'source' => ['type' => 'user', 'userId' => 'Ub0002']]]);
ok((int)val('SELECT is_following FROM friends WHERE line_user_id = "Ub0002"') === 0, 'unfollow で is_following=0');
webhook($admin, $ids['B'], $secrets['B'], [['type' => 'message', 'source' => ['type' => 'user', 'userId' => 'Ub0099'], 'message' => ['id' => '1', 'type' => 'text', 'text' => 'こんにちは']]]);
ok((int)val('SELECT COUNT(*) FROM friends WHERE line_user_id = "Ub0099"') === 1 && (int)val('SELECT COUNT(*) FROM inbound_messages') === 1, '未把握の人からのメッセージで友だち登録＋受信記録');
ok(count(array_filter(mockLog(), fn($e) => str_starts_with($e['path'], '/v2/bot/profile/') && $e['auth'] === 'Bearer TOKEN_A_abcdefghij')) >= 3, '復号したトークンで LINE API を呼ぶ');

// ============================================================
section('タグ・友だち画面');
foreach (['A', 'B'] as $k) $admin->page("/c/{$ids[$k]}/tags") && $admin->form("/c/{$ids[$k]}/tags", ['name' => 'イベント案内', 'color' => '#ff0000']);
$admin->page("/c/{$ids['A']}/tags");
$r = $admin->form("/c/{$ids['A']}/tags", ['name' => 'イベント案内']);
ok((int)val('SELECT COUNT(*) FROM tags WHERE channel_id = ? AND name = "イベント案内"', [$ids['A']]) === 1, '同名タグは重複作成されない');
$tagA = (int)val('SELECT id FROM tags WHERE channel_id = ? AND name = "イベント案内"', [$ids['A']]);
$tagB = (int)val('SELECT id FROM tags WHERE channel_id = ? AND name = "イベント案内"', [$ids['B']]);
$fA1 = (int)val('SELECT id FROM friends WHERE line_user_id = "Ua0001"');
$fA2 = (int)val('SELECT id FROM friends WHERE line_user_id = "Ua0002"');
$fAf = (int)val('SELECT id FROM friends WHERE line_user_id = "Ufail0003"');
$fB1 = (int)val('SELECT id FROM friends WHERE line_user_id = "Ub0001"');
$admin->page("/c/{$ids['A']}/friends/$fA1");
$admin->form("/c/{$ids['A']}/friends/$fA1/tags", ['tag_id' => $tagA]);
$admin->form("/c/{$ids['A']}/friends/$fB1/tags", ['tag_id' => $tagA]); // 別アカウントの友だち → 404 で無視
$admin->form("/c/{$ids['B']}/friends/$fB1/tags", ['tag_id' => $tagB]);
$admin->form("/c/{$ids['A']}/friends/$fA2/tags", ['tag_id' => $tagB]); // 別アカウントのタグ → 無視
ok((int)val('SELECT COUNT(*) FROM friend_tags') === 2, 'タグ付けは自アカウントの友だち×タグのみ有効', (string)val('SELECT COUNT(*) FROM friend_tags'));
$r = $admin->page("/c/{$ids['A']}/friends?q=" . urlencode('テスト'));
ok($r['status'] === 200 && str_contains($r['body'], 'イベント案内'), '友だち一覧・検索・タグ表示');
$admin->form("/c/{$ids['A']}/friends/$fA1/notes", ['notes' => '腰痛あり']);
ok(val('SELECT notes FROM friends WHERE id = ?', [$fA1]) === '腰痛あり', 'メモ保存');

// ============================================================
section('画像アップロードと配信');
$r = upload($admin, 'not an image', 'a.txt', 'text/plain');
ok($r['status'] === 400, '画像以外は拒否');
$r = upload($admin, tinyJpeg());
ok($r['status'] === 200 && preg_match('/^[a-f0-9]{32}$/', $r['json']['id'] ?? ''), 'JPEG をアップロード', json_encode($r));
$mid = $r['json']['id'];
ok($r['json']['width'] === 300 && $r['json']['height'] === 150, '画像サイズはサーバー側で判定');
$pub = new Http();
$r = $pub->req('GET', "/media/$mid");
ok($r['status'] === 200 && str_contains($r['headers'], 'image/jpeg') && str_contains($r['headers'], 'immutable'), '画像は未ログインでも取得できる(LINE 用)・長期キャッシュ');
$r = $pub->req('GET', "/media/$mid/1040");
ok($r['status'] === 200, 'imagemap 用 /1040 も取得できる');
ok($pub->req('GET', '/media/..%2Fconfig.php')['status'] === 404 && $pub->req('GET', '/media/' . str_repeat('a', 32))['status'] === 404, '不正な ID は 404');

$blocks = [
    ['type' => 'text', 'text' => "10月のイベントのお知らせです"],
    ['type' => 'image', 'mediaId' => $mid],
    ['type' => 'rich', 'mediaId' => $mid, 'ratio' => 0.5, 'layout' => '2h', 'altText' => 'リッチ', 'areas' => [['kind' => 'uri', 'value' => 'https://example.com/a'], ['kind' => 'text', 'value' => '予約したい']]],
    ['type' => 'cards', 'altText' => 'カード', 'cards' => [['title' => '整体', 'description' => '初回 1,980円', 'mediaId' => $mid, 'buttons' => [['label' => '予約', 'uri' => 'https://example.com/r'], ['label' => '詳細', 'uri' => 'tel:0312345678']]], ['title' => '鍼灸', 'description' => '', 'buttons' => []]]],
];
section('一括配信（全員）');
$bad = fn(array $b, string $needle, string $name) => (function () use ($admin, $ids, $b, $needle, $name) {
    $r = $admin->api('/api/campaigns', ['title' => 't', 'blocks' => $b, 'channelIds' => [$ids['A']], 'tagNames' => [], 'mode' => 'draft']);
    ok($r['status'] === 400 && str_contains((string)($r['json']['error'] ?? ''), $needle), $name, json_encode($r['json'], JSON_UNESCAPED_UNICODE));
})();
$bad([['type' => 'text', 'text' => '']], '本文', '空のテキストは拒否');
$bad([['type' => 'image', 'mediaId' => '']], 'アップロード', '画像未設定は拒否');
$bad([['type' => 'image', 'mediaId' => str_repeat('a', 32)]], 'アップロードされていない', '存在しない画像 ID は拒否');
$bad([['type' => 'rich', 'mediaId' => $mid, 'ratio' => 1, 'layout' => '2h', 'altText' => 'x', 'areas' => [['kind' => 'uri', 'value' => 'https://a.b']]]], 'エリア数', 'リッチのエリア数不一致は拒否');
$bad([['type' => 'rich', 'mediaId' => $mid, 'ratio' => 1, 'layout' => '1', 'altText' => 'x', 'areas' => [['kind' => 'uri', 'value' => 'javascript:alert(1)']]]], 'URL', 'リッチのリンクに javascript: は拒否');
$bad([['type' => 'cards', 'altText' => 'x', 'cards' => [['title' => 't', 'buttons' => [['label' => 'a', 'uri' => 'javascript:1']]]]]], 'URL', 'カードのボタンに javascript: は拒否');
$bad([['type' => 'cards', 'altText' => 'x', 'cards' => [['title' => 't', 'buttons' => array_fill(0, 4, ['label' => 'a', 'uri' => 'https://a.b'])]]]], 'ボタン', 'ボタン 4 つは拒否');
$bad(array_fill(0, 6, ['type' => 'text', 'text' => 'a']), '最大', '吹き出し 6 つは拒否');
$r = $admin->api('/api/campaigns', ['title' => 't', 'blocks' => $blocks, 'channelIds' => [], 'mode' => 'draft']);
ok($r['status'] === 400 && str_contains($r['json']['error'], 'アカウント'), 'アカウント未選択は拒否');
$r = $admin->api('/api/campaigns', ['title' => 't', 'blocks' => $blocks, 'channelIds' => [$ids['A']], 'mode' => 'schedule', 'scheduledAt' => gmdate('c', time() - 3600)]);
ok($r['status'] === 400 && str_contains($r['json']['error'], '過去'), '過去の予約日時は拒否');

$before = count(mockLog());
$r = $admin->api('/api/campaigns', ['title' => '10月イベント', 'blocks' => $blocks, 'channelIds' => [$ids['A'], $ids['B'], $ids['C']], 'tagNames' => [], 'mode' => 'now']);
ok($r['status'] === 200 && $r['json']['ok'], '3 アカウントへ即時配信');
$cid1 = (int)$r['json']['campaignId'];
$bs = q('SELECT * FROM broadcasts WHERE campaign_id = ? ORDER BY channel_id', [$cid1]);
ok(count($bs) === 3 && count(array_filter($bs, fn($b) => $b['status'] === 'sent')) === 3, '全て送信済み', json_encode(array_column($bs, 'status')));
$calls = array_values(array_filter(array_slice(mockLog(), $before), fn($e) => $e['path'] === '/v2/bot/message/broadcast'));
ok(count($calls) === 3, 'LINE broadcast API が 3 回呼ばれる', (string)count($calls));
ok(in_array('Bearer TOKEN_B_abcdefghij', array_column($calls, 'auth'), true) && in_array('Bearer TOKEN_C_abcdefghij', array_column($calls, 'auth'), true), 'アカウントごとに自分のトークンで送信');
$msgs = $calls[0]['body']['messages'];
ok(array_column($msgs, 'type') === ['text', 'image', 'imagemap', 'flex'], 'メッセージ種別: text/image/imagemap/flex');
ok(str_starts_with($msgs[2]['baseUrl'], BASE . '/media/' . $mid) && $msgs[2]['baseSize'] === ['width' => 1040, 'height' => 520], 'imagemap の baseUrl / baseSize');
ok($msgs[2]['actions'][0]['area'] === ['x' => 0, 'y' => 0, 'width' => 520, 'height' => 520] && $msgs[2]['actions'][1]['type'] === 'message', 'imagemap のタップ領域とアクション');
ok($msgs[3]['contents']['type'] === 'carousel' && count($msgs[3]['contents']['contents']) === 2 && isset($msgs[3]['contents']['contents'][0]['hero']) && !isset($msgs[3]['contents']['contents'][1]['footer']), 'flex carousel（画像・ボタンの有無）');
ok(!empty($calls[0]['retryKey']) && preg_match('/^[0-9a-f-]{36}$/', $calls[0]['retryKey']), 'X-Line-Retry-Key(UUID) を付与');
ok((int)val('SELECT total_targets FROM broadcasts WHERE campaign_id = ? AND channel_id = ?', [$cid1, $ids['A']]) === 3, '対象人数（ブロック除く友だち数）を記録');
$r = $admin->page("/campaigns/$cid1");
ok(str_contains($r['body'], '本店') && str_contains($r['body'], '渋谷店') && str_contains($r['body'], '送信済'), '詳細画面にアカウント別の結果');

section('一括配信（タグ絞り込み）');
$before = count(mockLog());
$r = $admin->api('/api/campaigns', ['title' => 'タグ配信', 'blocks' => [['type' => 'text', 'text' => 'タグ限定']], 'channelIds' => [$ids['A'], $ids['B'], $ids['C']], 'tagNames' => ['イベント案内'], 'mode' => 'now']);
$cid2 = (int)$r['json']['campaignId'];
$st = array_column(q('SELECT channel_id, status, error_message FROM broadcasts WHERE campaign_id = ?', [$cid2]), null, 'channel_id');
ok($st[$ids['A']]['status'] === 'sent' && $st[$ids['B']]['status'] === 'sent', 'タグのあるアカウントは送信');
ok($st[$ids['C']]['status'] === 'skipped' && str_contains($st[$ids['C']]['error_message'], 'タグ'), 'タグが無いアカウントは skipped（全員送信にならない）');
$mc = array_values(array_filter(array_slice(mockLog(), $before), fn($e) => $e['path'] === '/v2/bot/message/multicast'));
$tos = array_merge(...array_map(fn($e) => $e['body']['to'], $mc));
sort($tos);
ok($tos === ['Ua0001', 'Ub0001'], 'タグが付いた人だけに multicast', json_encode($tos));
ok(count(array_filter(array_slice(mockLog(), $before), fn($e) => $e['path'] === '/v2/bot/message/broadcast')) === 0, 'タグ指定のとき broadcast(全員) は呼ばれない');

// 一部失敗: Ufail を含むとモックが 400 を返す
$admin->form("/c/{$ids['A']}/friends/$fAf/tags", ['tag_id' => $tagA]);
$r = $admin->api('/api/campaigns', ['title' => '失敗テスト', 'blocks' => [['type' => 'text', 'text' => 'x']], 'channelIds' => [$ids['A'], $ids['B']], 'tagNames' => ['イベント案内'], 'mode' => 'now']);
$cid3 = (int)$r['json']['campaignId'];
$st = array_column(q('SELECT channel_id, status, error_message, success_count, failure_count FROM broadcasts WHERE campaign_id = ?', [$cid3]), null, 'channel_id');
ok($st[$ids['A']]['status'] === 'failed' && str_contains($st[$ids['A']]['error_message'], 'invalid user') && (int)$st[$ids['A']]['failure_count'] === 2, 'LINE のエラーを記録（失敗件数）', json_encode($st[$ids['A']], JSON_UNESCAPED_UNICODE));
ok($st[$ids['B']]['status'] === 'sent', '他アカウントの成功は影響を受けない');
$r = $admin->page("/campaigns/$cid3");
ok(str_contains($r['body'], 'invalid user'), '詳細画面にエラー内容を表示');
$r = $admin->page('/campaigns');
ok(str_contains($r['body'], '一部失敗'), '一覧で「一部失敗」表示');

section('予約配信・下書き・取消（cron）');
$r = $admin->api('/api/campaigns', ['title' => '予約', 'blocks' => [['type' => 'text', 'text' => '予約本文']], 'channelIds' => [$ids['A'], $ids['B']], 'tagNames' => [], 'mode' => 'schedule', 'scheduledAt' => gmdate('c', time() + 3600)]);
$cid4 = (int)$r['json']['campaignId'];
ok(q('SELECT status FROM broadcasts WHERE campaign_id = ?', [$cid4]) == [['status' => 'scheduled'], ['status' => 'scheduled']], '予約状態で作成');
$before = count(mockLog());
$out = cron();
ok(count(array_filter(array_slice(mockLog(), $before), fn($e) => str_contains($e['path'], '/message/'))) === 0, '時刻前の cron では送信されない', $out);
db()->exec("UPDATE broadcasts SET scheduled_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE) WHERE campaign_id = $cid4");
$out = cron();
ok(str_contains($out, 'broadcasts=2'), '時刻を過ぎた cron で 2 件送信', $out);
ok(q('SELECT status FROM broadcasts WHERE campaign_id = ?', [$cid4]) == [['status' => 'sent'], ['status' => 'sent']], '送信済みに更新');
$before = count(mockLog());
cron();
ok(count(array_filter(array_slice(mockLog(), $before), fn($e) => str_contains($e['path'], '/message/'))) === 0, 'cron を再実行しても二重送信しない');

$r = $admin->api('/api/campaigns', ['title' => '下書き', 'blocks' => [['type' => 'text', 'text' => 'd']], 'channelIds' => [$ids['A'], $ids['B']], 'tagNames' => [], 'mode' => 'draft']);
$cid5 = (int)$r['json']['campaignId'];
$before = count(mockLog());
$r = $admin->api("/api/campaigns/$cid5/execute");
ok($r['status'] === 200 && count($r['json']['results']) === 2, '下書きをいますぐ配信');
$r2 = $admin->api("/api/campaigns/$cid5/execute");
ok(count($r2['json']['results']) === 0 && count(array_filter(array_slice(mockLog(), $before), fn($e) => $e['path'] === '/v2/bot/message/broadcast')) === 2, '2 回目の実行では送信されない（二重送信防止）');
$r = $admin->api('/api/campaigns', ['title' => '取消', 'blocks' => [['type' => 'text', 'text' => 'c']], 'channelIds' => [$ids['A']], 'tagNames' => [], 'mode' => 'schedule', 'scheduledAt' => gmdate('c', time() + 7200)]);
$cid6 = (int)$r['json']['campaignId'];
$r = $admin->api("/api/campaigns/$cid6/cancel");
ok($r['json']['cancelled'] === 1 && val('SELECT status FROM broadcasts WHERE campaign_id = ?', [$cid6]) === 'cancelled', '予約を取り消し');
db()->exec("UPDATE broadcasts SET scheduled_at = UTC_TIMESTAMP() WHERE campaign_id = $cid6");
$before = count(mockLog()); cron();
ok(count(array_filter(array_slice(mockLog(), $before), fn($e) => str_contains($e['path'], '/message/'))) === 0, '取消した配信は cron でも送られない');

section('送信中断の検知');
$cid7 = (int)$admin->api('/api/campaigns', ['title' => '中断', 'blocks' => [['type' => 'text', 'text' => 's']], 'channelIds' => [$ids['A']], 'tagNames' => [], 'mode' => 'draft'])['json']['campaignId'];
db()->exec("UPDATE broadcasts SET status = 'sending', started_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 MINUTE) WHERE campaign_id = $cid7");
cron();
ok(val('SELECT status FROM broadcasts WHERE campaign_id = ?', [$cid7]) === 'failed' && str_contains((string)val('SELECT error_message FROM broadcasts WHERE campaign_id = ?', [$cid7]), '中断'), '長時間「送信中」のまま止まった配信は失敗扱い（自動再送しない）');
ok(file_exists(RUN . '/app/storage/logs/last_cron.txt'), 'cron の最終実行時刻を記録');
$r = $admin->page('/dashboard');
ok(!str_contains($r['body'], '定期実行（cron）が動いていません'), 'cron が動けば警告は消える');

// ============================================================
section('権限（オペレーター）');
$admin->page("/c/{$ids['A']}/settings");
$admin->form("/c/{$ids['A']}/members", ['login_id' => 'x y', 'name' => 'n', 'password' => 'oppassword1']);
ok((int)val('SELECT COUNT(*) FROM memberships') === 0, '不正なログインID(空白入り)の担当者は追加できない');
$r = $admin->form("/c/{$ids['A']}/members", ['login_id' => 'honten.staff', 'name' => '本店スタッフ', 'password' => 'oppassword1']);
ok((int)val('SELECT COUNT(*) FROM memberships') === 1, '担当者をログインIDで追加（新規ユーザー作成）');
$op = new Http(); $op->page('/login'); $op->form('/login', ['login_id' => 'honten.staff', 'password' => 'oppassword1']);
$r = $op->page('/dashboard');
ok($r['status'] === 200 && str_contains($r['body'], "/c/{$ids['A']}") === true, 'オペレーターは 1 アカウントなら直接そのアカウントへ');
ok(str_contains($op->page("/c/{$ids['A']}")['body'], '本店'), '担当アカウントの画面は見られる');
ok($op->req('GET', "/c/{$ids['B']}")['status'] === 403, '担当外アカウントは 403');
ok($op->req('GET', '/channels')['status'] === 403, 'アカウント管理は管理者のみ');
$op->page("/c/{$ids['A']}");
ok($op->api('/api/channels', ['name' => 'x'])['status'] === 403, 'アカウント追加 API は管理者のみ');
ok($op->api("/api/c/{$ids['A']}/settings", ['name' => 'x'])['status'] === 403, '設定変更 API は管理者のみ');
$r = $op->api('/api/campaigns', ['title' => 't', 'blocks' => [['type' => 'text', 'text' => 'x']], 'channelIds' => [$ids['A'], $ids['B']], 'tagNames' => [], 'mode' => 'draft']);
ok($r['status'] === 403, '担当外アカウントを含む配信は 403');
$r = $op->api('/api/campaigns', ['title' => 'op', 'blocks' => [['type' => 'text', 'text' => 'x']], 'channelIds' => [$ids['A']], 'tagNames' => [], 'mode' => 'draft']);
ok($r['status'] === 200, '担当アカウントへの配信は作成できる');
$r = $op->req('GET', "/campaigns/$cid4");
ok($r['status'] === 200, '担当アカウントを含む配信の詳細は見られる');
$onlyB = (int)$admin->api('/api/campaigns', ['title' => 'Bのみ', 'blocks' => [['type' => 'text', 'text' => 'x']], 'channelIds' => [$ids['B']], 'tagNames' => [], 'mode' => 'draft'])['json']['campaignId'];
ok($op->req('GET', "/campaigns/$onlyB")['status'] === 404, '担当外アカウントだけの配信は 404');
$r = $op->api("/api/campaigns/$onlyB/execute");
ok($r['status'] === 200 && count($r['json']['results']) === 0 && val('SELECT status FROM broadcasts WHERE campaign_id = ?', [$onlyB]) === 'draft', '担当外アカウントの配信は実行できない');
$op->page('/campaigns/new');
$r = $op->req('GET', '/campaigns/new');
ok(!str_contains($r['body'], '渋谷店'), '作成画面に担当外アカウントは出ない');

// ============================================================
section('ステップ配信');
$stepBlocks = fn($t) => [['type' => 'text', 'text' => $t]];
$sc = $admin->api("/api/c/{$ids['A']}/scenarios", ['name' => '初回フォロー', 'triggerType' => 'follow', 'isActive' => true, 'steps' => [
    ['delayMinutes' => 0, 'sendTime' => null, 'blocks' => $stepBlocks('ようこそ')],
    ['delayMinutes' => 1440, 'sendTime' => '10:00', 'blocks' => $stepBlocks('翌日10時')],
    ['delayMinutes' => 60, 'sendTime' => null, 'blocks' => [['type' => 'image', 'mediaId' => $mid]]],
]]);
ok($sc['status'] === 200, 'ステップ配信を作成', json_encode($sc['json'], JSON_UNESCAPED_UNICODE));
$sid = (int)$sc['json']['id'];
$r = $admin->api("/api/c/{$ids['A']}/scenarios", ['name' => 'x', 'triggerType' => 'tag_added', 'steps' => [['delayMinutes' => 0, 'blocks' => $stepBlocks('a')]]]);
ok($r['status'] === 400 && str_contains($r['json']['error'], 'タグ'), 'タグトリガーでタグ未選択は拒否');
$r = $admin->api("/api/c/{$ids['A']}/scenarios", ['name' => 'x', 'triggerType' => 'follow', 'steps' => [['delayMinutes' => 0, 'sendTime' => '25:61', 'blocks' => $stepBlocks('a')]]]);
ok($r['status'] === 400 && str_contains($r['json']['error'], 'HH:mm'), '不正な送信時刻は拒否');
$r = $admin->api("/api/c/{$ids['A']}/scenarios", ['name' => 'x', 'triggerType' => 'tag_added', 'triggerTagId' => $tagB, 'steps' => [['delayMinutes' => 0, 'blocks' => $stepBlocks('a')]]]);
ok($r['status'] === 400, '他アカウントのタグはトリガーにできない');
$r = $admin->page("/c/{$ids['A']}/scenarios");
ok(str_contains($r['body'], '初回フォロー') && str_contains($r['body'], 'ステップ配信とは') && str_contains($r['body'], '1日後 10:00'), '一覧画面（流れの要約を表示）');

$before = count(mockLog());
webhook($admin, $ids['A'], $secrets['A'], [$fol('Ua0100')]);
$runId = (int)val('SELECT r.id FROM scenario_runs r JOIN friends f ON f.id = r.friend_id WHERE f.line_user_id = "Ua0100"');
ok($runId > 0 && (int)val('SELECT COUNT(*) FROM scenario_run_steps WHERE run_id = ?', [$runId]) === 3, '友だち追加でステップ配信が開始（3 ステップ予約）');
$times = array_column(q('SELECT scheduled_at FROM scenario_run_steps WHERE run_id = ? ORDER BY id', [$runId]), 'scheduled_at');
$jst = fn($t) => (new DateTimeImmutable($t, new DateTimeZone('UTC')))->setTimezone(new DateTimeZone('Asia/Tokyo'));
ok(abs(strtotime($times[0] . ' UTC') - time()) < 5, 'ステップ 1 はすぐ');
ok($jst($times[1])->format('H:i') === '10:00' && $jst($times[1])->format('Y-m-d') === (new DateTimeImmutable('now', new DateTimeZone('Asia/Tokyo')))->modify('+1 day')->format('Y-m-d'), 'ステップ 2 は翌日 10:00（日本時間）', $times[1]);
ok(abs(strtotime($times[2] . ' UTC') - strtotime($times[1] . ' UTC') - 3600) < 2, 'ステップ 3 はステップ 2 の 1 時間後');
webhook($admin, $ids['A'], $secrets['A'], [$fol('Ua0100')]);
ok((int)val('SELECT COUNT(*) FROM scenario_runs WHERE scenario_id = ?', [$sid]) >= 1 && (int)val('SELECT COUNT(*) FROM scenario_runs r JOIN friends f ON f.id = r.friend_id WHERE f.line_user_id = "Ua0100"') === 1, '再 follow でも同じシナリオは 1 回だけ');
$out = cron();
$pushes = array_values(array_filter(array_slice(mockLog(), $before), fn($e) => $e['path'] === '/v2/bot/message/push'));
ok(count($pushes) >= 1 && $pushes[0]['body']['to'] === 'Ua0100' && $pushes[0]['body']['messages'][0]['text'] === 'ようこそ', 'cron でステップ 1 を push 送信', $out);
ok((int)val("SELECT COUNT(*) FROM scenario_run_steps WHERE run_id = ? AND status = 'sent'", [$runId]) === 1 && val('SELECT status FROM scenario_runs WHERE id = ?', [$runId]) === 'running', '残りは送信待ち・進行中');

// 編集: 進行中の送信待ちが消えず、本文だけ更新される
$r = $admin->api("/api/c/{$ids['A']}/scenarios/$sid", ['name' => '初回フォロー(改)', 'triggerType' => 'follow', 'isActive' => true, 'steps' => [
    ['delayMinutes' => 0, 'sendTime' => null, 'blocks' => $stepBlocks('ようこそ')],
    ['delayMinutes' => 1440, 'sendTime' => '10:00', 'blocks' => $stepBlocks('翌日10時【更新】')],
    ['delayMinutes' => 60, 'sendTime' => null, 'blocks' => $stepBlocks('3通目（画像→テキストに変更）')],
]]);
ok($r['status'] === 200 && (int)val("SELECT COUNT(*) FROM scenario_run_steps WHERE run_id = ? AND status = 'pending'", [$runId]) === 2, '編集しても進行中の送信待ちは消えない');
db()->exec("UPDATE scenario_run_steps SET scheduled_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE) WHERE run_id = $runId AND status = 'pending'");
$before = count(mockLog());
cron();
$pushes = array_values(array_filter(array_slice(mockLog(), $before), fn($e) => $e['path'] === '/v2/bot/message/push' && $e['body']['to'] === 'Ua0100'));
ok(count($pushes) === 2 && $pushes[0]['body']['messages'][0]['text'] === '翌日10時【更新】', '送信待ちには更新後の本文が送られる');
ok(val('SELECT status FROM scenario_runs WHERE id = ?', [$runId]) === 'completed', '全ステップ送信後に完了になる');

// ブロック中の友だちはスキップ
webhook($admin, $ids['A'], $secrets['A'], [$fol('Ua0200')]);
cron(); // ステップ 1 を送る
webhook($admin, $ids['A'], $secrets['A'], [['type' => 'unfollow', 'source' => ['type' => 'user', 'userId' => 'Ua0200']]]);
db()->exec("UPDATE scenario_run_steps rs JOIN scenario_runs r ON r.id = rs.run_id JOIN friends f ON f.id = r.friend_id SET rs.scheduled_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE) WHERE f.line_user_id = 'Ua0200' AND rs.status = 'pending'");
$before = count(mockLog()); cron();
ok(count(array_filter(array_slice(mockLog(), $before), fn($e) => $e['path'] === '/v2/bot/message/push')) === 0 && (int)val("SELECT COUNT(*) FROM scenario_run_steps rs JOIN scenario_runs r ON r.id = rs.run_id JOIN friends f ON f.id = r.friend_id WHERE f.line_user_id = 'Ua0200' AND rs.status = 'skipped'") === 2, 'ブロックした友だちには送らず skipped');

// タグをきっかけにするステップ配信
$tr = $admin->api("/api/c/{$ids['A']}/scenarios", ['name' => 'タグ開始', 'triggerType' => 'tag_added', 'triggerTagId' => $tagA, 'isActive' => true, 'steps' => [['delayMinutes' => 0, 'blocks' => $stepBlocks('タグありがとう')]]]);
ok($tr['status'] === 200, 'タグがきっかけのステップ配信を作成');
$tsid = (int)$tr['json']['id'];
$fA3 = (int)val('SELECT id FROM friends WHERE line_user_id = "Ua0100"');
$admin->form("/c/{$ids['A']}/friends/$fA3/tags", ['tag_id' => $tagA]);
$admin->form("/c/{$ids['A']}/friends/$fA3/tags", ['tag_id' => $tagA]); // 2 回付けても 1 回だけ
ok((int)val('SELECT COUNT(*) FROM scenario_runs WHERE scenario_id = ? AND friend_id = ?', [$tsid, $fA3]) === 1, 'タグ付与で開始（重複しない）');
$r = $admin->page("/c/{$ids['A']}/scenarios/$sid");
ok(str_contains($r['body'], '進行状況') && str_contains($r['body'], '開始した人'), '編集画面に進行状況');

// コピー・有効無効・削除
$r = $admin->api("/api/c/{$ids['A']}/scenarios/$tsid/copy", ['channelIds' => [$ids['C']]]);
ok($r['status'] === 200 && $r['json']['copied'] === 1, '他アカウントへコピー');
$copy = q('SELECT * FROM scenarios WHERE channel_id = ?', [$ids['C']])[0] ?? null;
ok($copy && (int)$copy['is_active'] === 0, 'コピー先は無効で作成される');
ok($copy && val('SELECT name FROM tags WHERE id = ?', [$copy['trigger_tag_id']]) === 'イベント案内' && (int)val('SELECT channel_id FROM tags WHERE id = ?', [$copy['trigger_tag_id']]) === $ids['C'], 'コピー先にタグが作られ、トリガーに設定される');
ok((int)val('SELECT COUNT(*) FROM scenario_steps WHERE scenario_id = ?', [$copy['id']]) === 1, 'ステップもコピーされる');
ok($op->api("/api/c/{$ids['A']}/scenarios/$tsid/copy", ['channelIds' => [$ids['B']]])['status'] === 403, '担当外アカウントへはコピーできない');
$r = $admin->api("/api/c/{$ids['A']}/scenarios/$tsid/toggle", ['isActive' => false]);
ok(val('SELECT is_active FROM scenarios WHERE id = ?', [$tsid]) == 0, '無効化');
$admin->api("/api/c/{$ids['A']}/scenarios/$tsid/delete");
ok(val('SELECT COUNT(*) FROM scenarios WHERE id = ?', [$tsid]) == 0, '削除');
ok($admin->api("/api/c/{$ids['B']}/scenarios/$sid/delete")['status'] === 404, '他アカウントのシナリオは操作できない');

// ============================================================
section('キーワード自動タグ付け（エリア別URL・社員の合言葉）');
// マイグレーション: テーブルが無くても、画面を開くと自動で作られる（旧バージョンからの更新を想定）
db()->exec('SET FOREIGN_KEY_CHECKS = 0');
db()->exec('DROP TABLE IF EXISTS keyword_rules');
db()->exec('DROP TABLE IF EXISTS schema_migrations');
db()->exec('SET FOREIGN_KEY_CHECKS = 1');
$r = $admin->page("/c/{$ids['A']}/keywords");
ok($r['status'] === 200 && val("SHOW TABLES LIKE 'keyword_rules'") && val("SHOW TABLES LIKE 'schema_migrations'"), 'テーブルが無くても画面を開くと自動で作られる（データベースの自動更新）');
ok(str_contains($r['body'], '自動タグ付け') && str_contains($r['body'], 'ルールはまだありません'), '自動タグ付けの画面');

$kw = fn(array $d, $c = null) => ($c ?? $admin)->api("/api/c/{$ids['A']}/keywords", $d);
$r = $kw(['keyword' => '', 'matchType' => 'exact', 'newTagName' => 'x']);
ok($r['status'] === 400 && str_contains($r['json']['error'], 'キーワード'), '空のキーワードは拒否');
$r = $kw(['keyword' => 'あ', 'matchType' => 'contains', 'newTagName' => 'x']);
ok($r['status'] === 400 && str_contains($r['json']['error'], '2 文字以上'), '「含む」で 1 文字のキーワードは拒否（誤反応を防ぐ）');
$r = $kw(['keyword' => 'テスト', 'matchType' => 'exact']);
ok($r['status'] === 400 && str_contains($r['json']['error'], 'タグ'), 'タグ未指定は拒否');
$r = $kw(['keyword' => 'テスト', 'matchType' => 'exact', 'tagId' => $tagB]);
ok($r['status'] === 400, '別アカウントのタグは使えない');

$r = $kw(['keyword' => '静岡エリア', 'matchType' => 'exact', 'newTagName' => 'エリア：静岡', 'replyText' => '静岡エリアで登録しました。ありがとうございます！']);
ok($r['status'] === 200, 'エリア用ルールを追加（新しいタグも同時に作成）');
$ruleArea = (int)$r['json']['id'];
$tagArea = (int)val('SELECT id FROM tags WHERE channel_id = ? AND name = "エリア：静岡"', [$ids['A']]);
ok($tagArea > 0, 'タグ「エリア：静岡」が作られている');
$r = $kw(['keyword' => '静岡エリア', 'matchType' => 'exact', 'tagId' => $tagArea]);
ok($r['status'] === 400 && str_contains($r['json']['error'], 'すでに'), '同じキーワード・同じタグの重複は拒否');
$r = $kw(['keyword' => '社員ひみつ合言葉', 'matchType' => 'contains', 'newTagName' => '社員']);
ok($r['status'] === 200, '社員用の合言葉ルールを追加（含む一致・返信なし）');
$ruleStaff = (int)$r['json']['id'];
$tagStaff = (int)val('SELECT id FROM tags WHERE channel_id = ? AND name = "社員"', [$ids['A']]);

// タグをきっかけにするステップ配信も、キーワードで付いたときに開始される
$sc2 = $admin->api("/api/c/{$ids['A']}/scenarios", ['name' => 'エリア登録後', 'triggerType' => 'tag_added', 'triggerTagId' => $tagArea, 'isActive' => true, 'steps' => [['delayMinutes' => 0, 'blocks' => [['type' => 'text', 'text' => 'エリア登録ありがとう']]]]]);
$scArea = (int)$sc2['json']['id'];

$webhook = fn(string $u, string $text) => webhook($admin, $ids['A'], $secrets['A'], [['type' => 'message', 'source' => ['type' => 'user', 'userId' => $u], 'replyToken' => 'rt-' . bin2hex(random_bytes(4)), 'message' => ['id' => bin2hex(random_bytes(4)), 'type' => 'text', 'text' => $text]]]);
$tagsOf = fn(string $u) => array_column(q('SELECT t.name FROM friend_tags ft JOIN tags t ON t.id = ft.tag_id JOIN friends f ON f.id = ft.friend_id WHERE f.line_user_id = ? AND f.channel_id = ? ORDER BY t.name', [$u, $ids['A']]), 'name');

webhook($admin, $ids['A'], $secrets['A'], [$fol('Uk0001'), $fol('Uk0002'), $fol('Uk0003'), $fol('Uk0004')]);
$before = count(mockLog());
$webhook('Uk0001', '静岡エリア');
ok($tagsOf('Uk0001') === ['エリア：静岡'], 'キーワードが一致するとタグが付く');
$rep = array_values(array_filter(array_slice(mockLog(), $before), fn($e) => $e['path'] === '/v2/bot/message/reply'));
ok(count($rep) === 1 && str_starts_with($rep[0]['body']['replyToken'], 'rt-') && str_contains($rep[0]['body']['messages'][0]['text'], '静岡エリアで登録しました'), '自動返信が replyToken で送られる');
ok((int)val('SELECT COUNT(*) FROM scenario_runs r JOIN friends f ON f.id = r.friend_id WHERE r.scenario_id = ? AND f.line_user_id = "Uk0001"', [$scArea]) === 1, 'タグがきっかけのステップ配信が開始される');

$before = count(mockLog());
$webhook('Uk0001', '静岡エリア');
ok($tagsOf('Uk0001') === ['エリア：静岡'] && (int)val('SELECT COUNT(*) FROM scenario_runs WHERE scenario_id = ?', [$scArea]) === 1, '同じ人が何度送ってもタグ・ステップ配信は重複しない');

$webhook('Uk0002', " 静岡ｴﾘｱ\u{3000}");
ok($tagsOf('Uk0002') === ['エリア：静岡'], '全角スペース・半角カナの違いを吸収して一致する');
$webhook('Uk0003', 'こんにちは');
ok($tagsOf('Uk0003') === [], '一致しないメッセージにはタグを付けない');
$before = count(mockLog());
$webhook('Uk0003', '静岡エリアについて質問です');
ok($tagsOf('Uk0003') === [] && count(array_filter(array_slice(mockLog(), $before), fn($e) => $e['path'] === '/v2/bot/message/reply')) === 0, '「完全一致」のルールは、文章の一部では反応しない・返信もしない');
$webhook('Uk0004', '私は社員ひみつ合言葉です');
ok($tagsOf('Uk0004') === ['社員'], '「含む」のルールは、文章の中にあれば反応する（社員タグ）');

// 配信での利用: 「エリア：静岡」タグの人だけに配信 / 「社員」タグの人だけに配信
$before = count(mockLog());
$r = $admin->api('/api/campaigns', ['title' => '静岡キャンペーン', 'blocks' => [['type' => 'text', 'text' => '静岡限定']], 'channelIds' => [$ids['A']], 'tagNames' => ['エリア：静岡'], 'mode' => 'now']);
$mc = array_values(array_filter(array_slice(mockLog(), $before), fn($e) => $e['path'] === '/v2/bot/message/multicast'));
$tos = array_merge(...array_map(fn($e) => $e['body']['to'], $mc ?: [['body' => ['to' => []]]]));
sort($tos);
ok($tos === ['Uk0001', 'Uk0002'], 'エリアのタグを付けた人だけに配信できる', json_encode($tos));
$before = count(mockLog());
$admin->api('/api/campaigns', ['title' => '社員連絡', 'blocks' => [['type' => 'text', 'text' => '社員向け']], 'channelIds' => [$ids['A']], 'tagNames' => ['社員'], 'mode' => 'now']);
$mc = array_values(array_filter(array_slice(mockLog(), $before), fn($e) => $e['path'] === '/v2/bot/message/multicast'));
ok(count($mc) === 1 && $mc[0]['body']['to'] === ['Uk0004'], '社員タグの人だけに配信できる');

// 登録用URL
$r = $admin->page("/c/{$ids['A']}/keywords");
ok(str_contains($r['body'], 'https://line.me/R/oaMessage/@mock123/?' . rawurlencode('静岡エリア')), '登録用URL（LINE ID + キーワード入力済み）が作られる');
ok(str_contains($r['body'], '社員ひみつ合言葉') && str_contains($r['body'], 'エリア：静岡'), 'ルール一覧にキーワードとタグが出る');

// 停止・削除
$admin->api("/api/c/{$ids['A']}/keywords/$ruleArea/toggle", ['isActive' => false]);
webhook($admin, $ids['A'], $secrets['A'], [$fol('Uk0005')]);
$webhook('Uk0005', '静岡エリア');
ok($tagsOf('Uk0005') === [], '停止したルールは反応しない');
$admin->api("/api/c/{$ids['A']}/keywords/$ruleArea/toggle", ['isActive' => true]);
$webhook('Uk0005', '静岡エリア');
ok($tagsOf('Uk0005') === ['エリア：静岡'], '再開すると反応する');
$admin->api("/api/c/{$ids['A']}/keywords/$ruleStaff/delete");
ok((int)val('SELECT COUNT(*) FROM keyword_rules WHERE id = ?', [$ruleStaff]) === 0, 'ルールを削除');
ok($admin->api("/api/c/{$ids['B']}/keywords/$ruleArea/delete")['status'] === 404, '他のアカウントのルールは操作できない');
ok($op->req('GET', "/c/{$ids['B']}/keywords")['status'] === 403, '担当外アカウントのルール画面は 403');

// ============================================================
section('アカウント設定・削除');
$r = $admin->api("/api/c/{$ids['A']}/settings", ['name' => '本店(改)', 'color' => '#123456', 'isActive' => true, 'description' => 'd']);
ok($r['status'] === 200 && val('SELECT name FROM line_channels WHERE id = ?', [$ids['A']]) === '本店(改)', '名前・色を変更');
$r = $admin->api("/api/c/{$ids['A']}/settings", ['name' => '本店', 'accessToken' => 'BAD_NEW_TOKEN_1234']);
ok($r['status'] === 400, '不正な新トークンは保存されない');
$r = $admin->api("/api/c/{$ids['A']}/settings", ['name' => '本店', 'color' => '#06C755', 'isActive' => true, 'accessToken' => 'TOKEN_A2_abcdefghijk']);
ok($r['status'] === 200, '新しいトークンに更新');
$before = count(mockLog());
webhook($admin, $ids['A'], $secrets['A'], [$fol('Ua0300')]);
ok(in_array('Bearer TOKEN_A2_abcdefghijk', array_column(array_slice(mockLog(), $before), 'auth'), true), '更新後のトークンが使われる');
$admin->api("/api/c/{$ids['C']}/settings", ['name' => '新宿店', 'color' => '#06C755', 'isActive' => false]);
ok(webhook($admin, $ids['C'], $secrets['C'], [])['status'] === 403, '無効なアカウントの Webhook は 403');
$r = $admin->api('/api/campaigns', ['title' => 't', 'blocks' => [['type' => 'text', 'text' => 'x']], 'channelIds' => [$ids['C']], 'mode' => 'draft']);
ok($r['status'] === 403, '無効なアカウントは配信先に選べない');
$admin->page("/c/{$ids['C']}/settings");
$admin->form("/c/{$ids['C']}/delete", ['confirm_name' => '違う名前']);
ok((int)val('SELECT COUNT(*) FROM line_channels WHERE id = ?', [$ids['C']]) === 1, '確認名が違えば削除されない');
$admin->form("/c/{$ids['C']}/delete", ['confirm_name' => '新宿店']);
ok((int)val('SELECT COUNT(*) FROM line_channels WHERE id = ?', [$ids['C']]) === 0 && (int)val('SELECT COUNT(*) FROM friends WHERE channel_id = ?', [$ids['C']]) === 0, '削除すると友だち等も連動して削除');

// ============================================================
section('画面の表示確認（主要ページが 200）');
foreach (['/dashboard', '/campaigns', '/campaigns/new', "/campaigns/$cid1", '/channels', '/channels/new', "/c/{$ids['A']}", "/c/{$ids['A']}/friends", "/c/{$ids['A']}/friends/$fA1", "/c/{$ids['A']}/tags", "/c/{$ids['A']}/broadcasts", "/c/{$ids['A']}/scenarios", "/c/{$ids['A']}/scenarios/new", "/c/{$ids['A']}/scenarios/$sid", "/c/{$ids['A']}/settings", '/account/password'] as $path) {
    $r = $admin->page($path);
    ok($r['status'] === 200 && !str_contains($r['body'], 'Fatal error') && !str_contains($r['body'], 'Warning:') && !str_contains($r['body'], 'Notice:'), "GET $path", (string)$r['status']);
}
ok($admin->req('GET', '/nonexistent')['status'] === 404, '存在しないページは 404');

// ============================================================
section('ステップ送信時刻の計算（日本時間）');
define('APP_DIR_TEST', true);
require_once RUN . '/app/bootstrap.php';
$u = new DateTimeZone('UTC');
$t = fn(string $iso, int $d, ?string $time) => Scenarios::computeStepTime(new DateTimeImmutable($iso, $u), $d, $time)->setTimezone(new DateTimeZone('Asia/Tokyo'))->format('Y-m-d H:i');
ok($t('2026-10-02 06:30:00', 0, null) === '2026-10-02 15:30', '経過 0 分 = すぐ');
ok($t('2026-10-02 06:30:00', 90, null) === '2026-10-02 17:00', '90 分後');
ok($t('2026-10-02 06:30:00', 1440, '10:00') === '2026-10-03 10:00', '翌日 10:00');
ok($t('2026-10-02 06:30:00', 0, '10:00') === '2026-10-02 15:30', '0 日後で時刻を過ぎていればすぐ');
ok($t('2026-10-02 06:30:00', 0, '18:00') === '2026-10-02 18:00', '0 日後の 18:00');
ok($t('2026-10-02 16:00:00', 1440, '10:00') === '2026-10-04 10:00', '日本時間で日付をまたぐ場合（JST 10/3 01:00 の翌日 = 10/4）');
ok($t('2026-10-02 06:30:00', 43200, '09:30') === '2026-11-01 09:30', '30 日後 09:30');
foreach ([[['sent', 'sent'], 'sent'], [['sent', 'failed'], 'partial'], [['failed', 'skipped'], 'failed'], [['sent', 'scheduled'], 'scheduled'], [['cancelled', 'skipped'], 'cancelled'], [['sent', 'sending'], 'sending'], [['draft', 'sent'], 'draft']] as [$in, $want]) {
    ok(Campaigns::summarize($in) === $want, '配信全体の状態: ' . implode('+', $in) . " → $want");
}
ok(Scenarios::formatMinutes(10260) === '7日3時間' && Scenarios::formatMinutes(90) === '90分' && Scenarios::formatMinutes(180) === '3時間' && Scenarios::formatMinutes(1500) === '1日1時間', '待ち時間の表示（日・時間・分）');
ok(Scenarios::cumulativeLabels([['delay_minutes' => 0, 'send_time' => null], ['delay_minutes' => 1440, 'send_time' => '10:00'], ['delay_minutes' => 4320, 'send_time' => '10:00']]) === ['すぐ', '1日後 10:00', '4日後 10:00'], '累計ラベル');

ok(Keywords::normalize('ＡＢＣ　ｱｲｳ  Def') === 'abcアイウdef', '正規化（全角英数・半角カナ・空白・大文字小文字）');
ok(Keywords::matches('80SKIP 社員', '80SKIP社員', 'exact') && Keywords::matches("80SKIP\u{00A0}社員", '80skip社員', 'exact') && Keywords::matches("80SKIP\u{200B}社員", '80SKIP社員', 'exact'), '空白の有無・種類（半角/全角/改行なし空白/見えない空白）を問わず一致する');
ok(!Keywords::matches('80SKIP 社員です', '80SKIP社員', 'exact'), '完全一致は、余計な文字があれば一致しない');
ok(Keywords::matches('ご質問 静岡エリア です', '静岡エリア', 'contains') && !Keywords::matches('ご質問 静岡エリア です', '静岡エリア', 'exact'), '一致判定（含む／完全一致）');

echo "\n";
echo "結果: $pass 件成功 / $fail 件失敗\n";
exit($fail > 0 ? 1 : 0);
