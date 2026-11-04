<?php
/*
 * LP 管理画面（LINE・電話・空き状況カレンダーのリンク先を変更）
 * --------------------------------------------------------------
 * 置き場所：index.html と同じフォルダ
 * 開き方　：https://（LPのURL）/admin.php
 *
 * 保存すると、同じフォルダの index.html と settings.js のリンク先を書き換えます。
 * パスワード（暗号化済み）や現在の設定値は admin-config.php に保存されます（ブラウザからは中身は見えません）。
 * 手で編集しないでください。
 */
declare(strict_types=1);

const CONFIG_FILE  = __DIR__ . '/admin-config.php';
const INDEX_FILE   = __DIR__ . '/index.html';
const SETTINGS_JS  = __DIR__ . '/settings.js';
const MAX_FAILS    = 5;     // この回数ログインに失敗すると…
const LOCK_SECONDS = 900;   // …この秒数（15分）ログインできなくなる

header('X-Robots-Tag: noindex, nofollow');
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('Cache-Control: no-store');

session_set_cookie_params([
    'lifetime' => 0,
    'path'     => dirname($_SERVER['SCRIPT_NAME']) === '/' ? '/' : dirname($_SERVER['SCRIPT_NAME']) . '/',
    'secure'   => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_name('lp_admin');
session_start();

/* ---------- 設定ファイル ---------- */
const CONFIG_GUARD = "<?php http_response_code(404); exit; ?>\n";
// 設定はJSONで保存し、先頭にPHPの1行を付けてブラウザから中身が見えないようにしている。
// include せずに読むので、PHPのキャッシュ（OPcache）で古い内容が返ることがない。
function load_config(): array {
    if (!is_file(CONFIG_FILE)) return [];
    $raw = (string)file_get_contents(CONFIG_FILE);
    if (strpos($raw, CONFIG_GUARD) === 0) $raw = substr($raw, strlen(CONFIG_GUARD));
    $c = json_decode($raw, true);
    return is_array($c) ? $c : [];
}
function save_config(array $c): bool {
    return write_atomic(CONFIG_FILE, CONFIG_GUARD . json_encode($c, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n");
}
function write_atomic(string $path, string $data): bool {
    $tmp = $path . '.tmp' . bin2hex(random_bytes(4));
    if (file_put_contents($tmp, $data, LOCK_EX) === false) return false;
    $perm = is_file($path) ? (fileperms($path) & 0777) : 0644;
    if (!rename($tmp, $path)) { @unlink($tmp); return false; }
    @chmod($path, $perm);
    return true;
}
function h(?string $s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function client_ip(): string { return $_SERVER['REMOTE_ADDR'] ?? 'unknown'; }

/* ---------- 入力チェック ---------- */
function validate(array $in): array {
    $v = [
        'line'          => trim((string)($in['line'] ?? '')),
        'tel'           => trim(mb_convert_kana((string)($in['tel'] ?? ''), 'as', 'UTF-8')),
        'calendarPage'  => trim((string)($in['calendarPage'] ?? '')),
        'calendarEmbed' => trim((string)($in['calendarEmbed'] ?? '')),
    ];
    $v['tel'] = str_replace(['ー', '－', '―', '‐'], '-', $v['tel']);
    $err = [];
    foreach (['line' => 'LINEのURL', 'calendarPage' => '空き状況（大きく開く）のURL', 'calendarEmbed' => '空き状況（埋め込み）のURL'] as $k => $label) {
        if (!preg_match('~^https://[^\s"<>]+$~', $v[$k]) || !filter_var($v[$k], FILTER_VALIDATE_URL)) {
            $err[$k] = "{$label}は https:// から始まるURLを入力してください。";
        }
    }
    $digits = preg_replace('/\D/', '', $v['tel']);
    if (!preg_match('/^[0-9\-]+$/', $v['tel']) || strlen($digits) < 10 || strlen($digits) > 11) {
        $err['tel'] = '電話番号は 054-207-7007 のように数字とハイフンで入力してください。';
    }
    return [$v, $err];
}

/* ---------- index.html / settings.js の書き換え ---------- */
function rewrite_index(string $html, array $s, int $ver, ?int &$count = null): string {
    $count = 0;
    $attr = function (string $link, string $name, string $value) use (&$html, &$count): void {
        $html = preg_replace_callback(
            '~(<[a-z]+\b[^>]*\bdata-link="' . preg_quote($link, '~') . '"[^>]*?\s' . $name . '=")[^"]*(")~i',
            function ($m) use ($value) { return $m[1] . h($value) . $m[2]; },
            $html, -1, $n
        );
        $count += $n;
    };
    $attr('line', 'href', $s['line']);
    $attr('tel', 'href', 'tel:' . preg_replace('/\D/', '', $s['tel']));
    $attr('calendar-page', 'href', $s['calendarPage']);
    $attr('calendar-embed', 'src', $s['calendarEmbed']);
    $html = preg_replace_callback(
        '~(<a\b[^>]*\bdata-tel-text\b[^>]*>)[^<]*(</a>)~',
        function ($m) use ($s) { return $m[1] . h($s['tel']) . $m[2]; },
        $html
    );
    $html = preg_replace('~<script src="settings\.js(?:\?v=\d+)?"></script>~', '<script src="settings.js?v=' . $ver . '"></script>', $html);
    return $html;
}
function settings_js(array $s): string {
    $j = json_encode($s, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    return <<<JS
/*
 * リンク先の設定
 * --------------------------------------------------
 * このファイルは管理画面（admin.php）から保存すると自動で書き換わります。
 * 変更は管理画面から行ってください。
 */
var LP_SETTINGS = {$j};

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

JS;
}
function apply_settings(array $s, string &$error): bool {
    if (!is_writable(INDEX_FILE) || !is_writable(SETTINGS_JS)) {
        $error = 'index.html または settings.js を書き換えられません。ファイルのパーミッションを 644（または 604）にしてください。';
        return false;
    }
    $html = file_get_contents(INDEX_FILE);
    $new  = rewrite_index($html, $s, time(), $n);
    if ($n < 4) {
        $error = 'index.html の中にリンクの目印（data-link）が見つかりません。index.html が別のファイルに置き換わっていないか確認してください。';
        return false;
    }
    if (!write_atomic(SETTINGS_JS, settings_js($s)) || !write_atomic(INDEX_FILE, $new)) {
        $error = 'ファイルの保存に失敗しました。サーバーの空き容量とパーミッションを確認してください。';
        return false;
    }
    return true;
}

/* ---------- 処理 ---------- */
$config = load_config();
if (empty($config['password_hash'])) {
    http_response_code(500);
    exit('admin-config.php が見つかりません。admin.php と同じフォルダにアップロードしてください。');
}
if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
$csrf   = $_SESSION['csrf'];
$authed = !empty($_SESSION['authed']);
$msg = ''; $error = ''; $fieldErr = [];
$current = $config['settings'] ?? [];
$form    = $current;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = (string)($_POST['action'] ?? '');
    if (!hash_equals($csrf, (string)($_POST['csrf'] ?? ''))) {
        $error = '画面の有効期限が切れました。もう一度操作してください。';
    } elseif ($action === 'login') {
        $ip = client_ip(); $now = time();
        $fails = array_filter($config['fails'] ?? [], function ($f) use ($now) { return $f['until'] > $now || $f['last'] > $now - LOCK_SECONDS; });
        $f = $fails[$ip] ?? ['count' => 0, 'last' => 0, 'until' => 0];
        if ($f['until'] > $now) {
            $error = 'ログインに続けて失敗したため、しばらくログインできません。' . ceil(($f['until'] - $now) / 60) . '分後にもう一度お試しください。';
        } elseif (password_verify((string)($_POST['password'] ?? ''), $config['password_hash'])) {
            unset($fails[$ip]);
            $config['fails'] = $fails; save_config($config);
            session_regenerate_id(true);
            $_SESSION['authed'] = true;
            $_SESSION['csrf'] = bin2hex(random_bytes(16));
            header('Location: ' . strtok($_SERVER['REQUEST_URI'], '?')); exit;
        } else {
            usleep(800000);
            $f['count']++; $f['last'] = $now;
            if ($f['count'] >= MAX_FAILS) { $f['until'] = $now + LOCK_SECONDS; $f['count'] = 0; }
            $fails[$ip] = $f; $config['fails'] = $fails; save_config($config);
            $error = 'パスワードが違います。';
        }
    } elseif (!$authed) {
        $error = 'ログインしてください。';
    } elseif ($action === 'logout') {
        $_SESSION = []; session_destroy();
        header('Location: ' . strtok($_SERVER['REQUEST_URI'], '?')); exit;
    } elseif ($action === 'save' || $action === 'undo') {
        if ($action === 'undo') {
            $v = $config['previous'] ?? null; $fieldErr = $v ? [] : ['_' => 1];
            if (!$v) $error = '戻せる設定がありません。';
        } else {
            [$v, $fieldErr] = validate($_POST);
            $form = $v;
            if ($fieldErr) $error = '入力内容を確認してください。';
        }
        if (!$fieldErr && $v) {
            if (apply_settings($v, $error)) {
                $config['previous'] = $current;
                $config['settings'] = $v;
                $config['updated']  = date('Y-m-d H:i');
                save_config($config);
                $current = $form = $v;
                $msg = $action === 'undo' ? 'ひとつ前の設定に戻しました。' : '保存しました。LPに反映されています。';
            }
        }
    } elseif ($action === 'password') {
        $cur = (string)($_POST['current'] ?? ''); $new = (string)($_POST['new'] ?? ''); $new2 = (string)($_POST['new2'] ?? '');
        if (!password_verify($cur, $config['password_hash'])) $error = '今のパスワードが違います。';
        elseif (strlen($new) < 10) $error = '新しいパスワードは10文字以上にしてください。';
        elseif ($new !== $new2) $error = '新しいパスワード（確認）が一致しません。';
        else {
            $config['password_hash'] = password_hash($new, PASSWORD_DEFAULT);
            $msg = save_config($config) ? 'パスワードを変更しました。' : 'パスワードの保存に失敗しました。';
        }
    }
}
$fields = [
    'line'          => ['LINEで申し込む', 'LINE公式アカウントの友だち追加URL（例：https://lin.ee/xxxxxxx）', 'url', 'LPの「LINEで申し込む」ボタン 5か所'],
    'tel'           => ['電話番号', 'ハイフンありで入力（例：054-207-7007）', 'tel', '「電話で申し込む」ボタン 6か所と電話番号の表示'],
    'calendarPage'  => ['空き状況カレンダー（大きく開く）', 'ボタンを押したときに開くページのURL', 'url', '「カレンダーを大きく開く」ボタン'],
    'calendarEmbed' => ['空き状況カレンダー（ページ内に表示）', 'Canvaの「共有」→「埋め込み」で表示されるURL（…/view?embed）', 'url', 'ページ内に表示されるカレンダー'],
];
?><!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>LP管理画面</title>
<style>
:root{--p:#142d5c;--lime:#d5fb42;--ink:#1e293b;--muted:#647084;--line:#dce3ed;--bg:#f3f6fa;--ok:#0f7b4b;--ng:#c0262d}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:"Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,sans-serif;line-height:1.7}
header{background:var(--p);color:#fff;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px}
header b{font-size:16px}header form{margin:0}
main{max-width:720px;margin:0 auto;padding:20px 16px 60px}
.card{background:#fff;border:1px solid var(--line);border-radius:10px;padding:20px;margin-bottom:18px}
h2{font-size:17px;margin:0 0 14px;color:var(--p)}
label{display:block;font-weight:700;margin-top:16px}label:first-of-type{margin-top:0}
.hint{display:block;font-size:12px;color:var(--muted);font-weight:400}
input[type=text],input[type=url],input[type=tel],input[type=password]{width:100%;font:inherit;font-size:16px;padding:10px 12px;border:1px solid #b9c4d3;border-radius:6px;margin-top:6px}
input[aria-invalid=true]{border-color:var(--ng);background:#fff6f6}
.where{font-size:12px;color:var(--muted);margin-top:4px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
.where a{color:var(--p)}
.err{color:var(--ng);font-size:13px;margin-top:4px}
button{font:inherit;font-weight:800;border:0;border-radius:6px;padding:12px 22px;cursor:pointer;background:var(--p);color:#fff}
button.lime{background:var(--lime);color:var(--p)}button.ghost{background:transparent;color:inherit;border:1px solid currentColor;padding:6px 14px;font-size:13px}
button.sub{background:#e6ebf2;color:var(--ink)}
.row{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px;align-items:center}
.flash{padding:12px 14px;border-radius:8px;margin-bottom:18px;font-weight:700}
.flash.ok{background:#e5f6ee;color:var(--ok)}.flash.ng{background:#fdeced;color:var(--ng)}
.meta{font-size:12px;color:var(--muted);overflow-wrap:anywhere}
.row a{color:var(--p);font-weight:700}
details summary{cursor:pointer;font-weight:700;color:var(--p)}
.login{max-width:380px;margin:60px auto}
</style></head><body>
<header><b>アローズ LP管理画面</b><?php if ($authed): ?><form method="post"><input type="hidden" name="csrf" value="<?= h($_SESSION['csrf']) ?>"><button class="ghost" name="action" value="logout">ログアウト</button></form><?php endif; ?></header>
<main>
<?php if ($msg): ?><div class="flash ok" role="status"><?= h($msg) ?></div><?php endif; ?>
<?php if ($error): ?><div class="flash ng" role="alert"><?= h($error) ?></div><?php endif; ?>

<?php if (!$authed): ?>
  <div class="card login">
    <h2>ログイン</h2>
    <form method="post">
      <input type="hidden" name="csrf" value="<?= h($csrf) ?>">
      <label for="pw">パスワード</label>
      <input type="password" id="pw" name="password" autocomplete="current-password" required autofocus>
      <div class="row"><button name="action" value="login">ログイン</button></div>
    </form>
  </div>
<?php else: ?>
  <form method="post" class="card">
    <h2>リンク先の設定</h2>
    <input type="hidden" name="csrf" value="<?= h($_SESSION['csrf']) ?>">
    <?php foreach ($fields as $k => [$label, $hint, $type, $where]): ?>
      <label for="f-<?= $k ?>"><?= h($label) ?><span class="hint"><?= h($hint) ?></span></label>
      <input type="<?= $type === 'tel' ? 'tel' : 'url' ?>" id="f-<?= $k ?>" name="<?= $k ?>" value="<?= h($form[$k] ?? '') ?>" required<?= isset($fieldErr[$k]) ? ' aria-invalid="true"' : '' ?> inputmode="<?= $type === 'tel' ? 'tel' : 'url' ?>" autocomplete="off" spellcheck="false">
      <?php if (isset($fieldErr[$k])): ?><div class="err"><?= h($fieldErr[$k]) ?></div><?php endif; ?>
      <div class="where"><span>反映先：<?= h($where) ?></span><?php if (!empty($current[$k])): ?><a href="<?= h($type === 'tel' ? 'tel:' . preg_replace('/\D/', '', $current[$k]) : $current[$k]) ?>" target="_blank" rel="noopener noreferrer">今の設定を開いて確認</a><?php endif; ?></div>
    <?php endforeach; ?>
    <div class="row">
      <button class="lime" name="action" value="save">保存してLPに反映</button>
      <a href="./" target="_blank" rel="noopener">LPを開く</a>
    </div>
    <?php if (!empty($config['updated'])): ?><p class="meta">最終更新：<?= h($config['updated']) ?></p><?php endif; ?>
  </form>

  <?php if (!empty($config['previous'])): ?>
  <form method="post" class="card" onsubmit="return confirm('ひとつ前の設定に戻しますか？')">
    <h2>ひとつ前の設定に戻す</h2>
    <input type="hidden" name="csrf" value="<?= h($_SESSION['csrf']) ?>">
    <p class="meta"><?php foreach ($fields as $k => $f) echo h($f[0]) . '：' . h($config['previous'][$k] ?? '') . '<br>'; ?></p>
    <button class="sub" name="action" value="undo">この設定に戻す</button>
  </form>
  <?php endif; ?>

  <details class="card">
    <summary>パスワードを変更する</summary>
    <form method="post" style="margin-top:14px">
      <input type="hidden" name="csrf" value="<?= h($_SESSION['csrf']) ?>">
      <label for="pc">今のパスワード</label><input type="password" id="pc" name="current" autocomplete="current-password" required>
      <label for="pn">新しいパスワード<span class="hint">10文字以上</span></label><input type="password" id="pn" name="new" autocomplete="new-password" minlength="10" required>
      <label for="pn2">新しいパスワード（確認）</label><input type="password" id="pn2" name="new2" autocomplete="new-password" minlength="10" required>
      <div class="row"><button name="action" value="password">パスワードを変更</button></div>
    </form>
  </details>
<?php endif; ?>
</main></body></html>
