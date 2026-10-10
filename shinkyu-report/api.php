<?php
/**
 * 鍼施術内容書 — 同期API（Xサーバー等の PHP レンタルサーバー用）
 *
 * データはキーと値の組（kv テーブル）で保存する。キーは画面側の localStorage と同じ。
 *   shinq:rec:<id>  内容書   … 値の rev が保存済みより大きい時だけ受け付ける（同時編集で上書きしない）
 *   shinq:pat:<氏名> 患者様  … 後から保存した方を採用
 *   shinq:log:<id>  ログ     … 追加のみ。既にあるログは変更・削除できない
 *   shinq:settings  設定     … 後から保存した方を採用
 * 書き込みのたびに通し番号（seq）を振り、各端末は「前回以降の変更」を取りに来る。
 *
 * a=me    ログイン状態の確認
 * a=login パスワードでログイン（POST {password}）
 * a=logout
 * a=pull  変更の取得（GET since=<seq>）
 * a=push  変更の送信（POST {items:[{key, value(文字列 or null)}]}）
 * a=mail  内容書の PDF をメールで送る（POST {to, subject, body, filename, pdf(base64)}）
 *         送信先は「設定」に登録された接骨院のアドレスだけ。送り主は config.php の mail_from
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    fail(500, 'config.php がありません。config.sample.php をコピーして config.php を作成してください。');
}
$config = require $configFile;
if (($config['password'] ?? '') === '' || ($config['password'] ?? '') === 'change-me') {
    fail(500, 'config.php の password を設定してください。');
}

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
$lifetime = 60 * 60 * 24 * (int)($config['login_days'] ?? 30);
ini_set('session.gc_maxlifetime', (string)$lifetime);
ini_set('session.use_strict_mode', '1');
session_name('SHINQSESS');
session_set_cookie_params([
    'lifetime' => $lifetime,
    'path' => rtrim(dirname($_SERVER['SCRIPT_NAME']), '/') . '/',
    'secure' => $https,
    'httponly' => true,
    'samesite' => 'Strict',
]);
// セッションファイルはこのアプリ専用の場所に置く（共用サーバーの既定の掃除で早く消えないように）
$sessDir = dataDir($config) . '/sessions';
if (!is_dir($sessDir)) @mkdir($sessDir, 0700, true);
if (is_dir($sessDir) && is_writable($sessDir)) session_save_path($sessDir);
session_start();

$action = $_GET['a'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// 他サイトからの書き込みを防ぐ（画面側は必ずこのヘッダーを付ける）
if ($method === 'POST' && ($_SERVER['HTTP_X_SHINQ'] ?? '') !== '1') {
    fail(403, 'forbidden');
}

switch ($action) {
    case 'me':
        out(['loggedIn' => !empty($_SESSION['ok'])]);

    case 'login':
        if ($method !== 'POST') fail(405, 'POST only');
        $body = jsonBody();
        $pw = (string)($body['password'] ?? '');
        $guard = loginGuard($config);
        if ($guard['locked']) {
            fail(429, 'パスワードを続けて間違えたため、しばらくログインできません（' . $guard['minutes'] . '分後に再度お試しください）');
        }
        if (!hash_equals((string)$config['password'], $pw)) {
            loginGuard($config, false);
            sleep(2); // 総当たり対策
            fail(401, 'パスワードが違います');
        }
        loginGuard($config, true);
        session_regenerate_id(true);
        $_SESSION['ok'] = true;
        out(['loggedIn' => true]);

    case 'logout':
        $_SESSION = [];
        session_destroy();
        out(['loggedIn' => false]);

    case 'pull':
        requireLogin();
        $since = max(0, (int)($_GET['since'] ?? 0));
        $limit = 500;
        $pdo = db($config);
        $st = $pdo->prepare('SELECT k, v, seq FROM kv WHERE seq > ? ORDER BY seq LIMIT ' . ($limit + 1));
        $st->execute([$since]);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC);
        $more = count($rows) > $limit;
        if ($more) array_pop($rows);
        $items = array_map(fn($r) => ['key' => $r['k'], 'value' => $r['v'], 'seq' => (int)$r['seq']], $rows);
        $seq = $items ? end($items)['seq'] : currentSeq($pdo);
        out(['items' => $items, 'seq' => max($seq, $since), 'more' => $more]);

    case 'push':
        requireLogin();
        if ($method !== 'POST') fail(405, 'POST only');
        $body = jsonBody();
        $items = $body['items'] ?? null;
        if (!is_array($items) || count($items) > 200) fail(400, 'items が不正です');
        $pdo = db($config);
        $results = [];
        foreach ($items as $it) {
            $results[] = pushOne($pdo, $it);
        }
        out(['results' => $results]);

    case 'mail':
        requireLogin();
        if ($method !== 'POST') fail(405, 'POST only');
        $body = jsonBody();
        out(sendSheetMail($config, $body));

    default:
        fail(404, 'unknown action');
}

// ---------------------------------------------------------------------------

function pushOne(PDO $pdo, $it): array
{
    $key = is_array($it) ? (string)($it['key'] ?? '') : '';
    $val = is_array($it) && array_key_exists('value', $it) ? $it['value'] : false;
    if (!preg_match('/^shinq:(settings|(rec|pat|log):.{1,150})$/u', $key)) {
        return ['key' => $key, 'ok' => false, 'error' => 'bad key'];
    }
    if ($val !== null && !is_string($val)) return ['key' => $key, 'ok' => false, 'error' => 'bad value'];
    if (is_string($val)) {
        if (strlen($val) > 1024 * 1024) return ['key' => $key, 'ok' => false, 'error' => 'too large'];
        $decoded = json_decode($val, true);
        if (!is_array($decoded)) return ['key' => $key, 'ok' => false, 'error' => 'bad json'];
    }
    $kind = explode(':', $key)[1];

    begin($pdo);
    try {
        $cur = currentValue($pdo, $key);
        $accept = true;
        if ($cur !== null && $val === $cur) {
            // 同じ内容の再送（通信の再試行など）は成功扱い
            commit($pdo);
            return ['key' => $key, 'ok' => true];
        }
        if ($kind === 'log') {
            // ログは追加のみ
            $accept = $cur === null && $val !== null;
        } elseif ($kind === 'rec' && $val !== null && $cur !== null) {
            // 内容書は版番号が進んでいる時だけ受け付ける
            $old = json_decode($cur, true);
            $accept = (int)($decoded['rev'] ?? 0) > (int)($old['rev'] ?? 0);
        }
        if (!$accept) {
            commit($pdo);
            return ['key' => $key, 'ok' => false, 'conflict' => true, 'current' => $cur];
        }
        $seq = nextSeq($pdo);
        $st = $pdo->prepare('UPDATE kv SET v = ?, seq = ? WHERE k = ?');
        $st->execute([$val, $seq, $key]);
        if ($st->rowCount() === 0) {
            // 削除済み（または未登録）のキーへの削除は記録だけ残す
            $pdo->prepare('INSERT INTO kv (k, v, seq) VALUES (?, ?, ?)')->execute([$key, $val, $seq]);
        }
        commit($pdo);
        return ['key' => $key, 'ok' => true, 'seq' => $seq];
    } catch (Throwable $e) {
        rollback($pdo);
        return ['key' => $key, 'ok' => false, 'error' => 'db error'];
    }
}

function currentValue(PDO $pdo, string $key): ?string
{
    $sql = 'SELECT v FROM kv WHERE k = ?' . (isMysql($pdo) ? ' FOR UPDATE' : '');
    $st = $pdo->prepare($sql);
    $st->execute([$key]);
    $v = $st->fetchColumn();
    return $v === false ? null : $v;
}

function nextSeq(PDO $pdo): int
{
    $pdo->exec("UPDATE meta SET val = val + 1 WHERE name = 'seq'");
    return currentSeq($pdo);
}

function currentSeq(PDO $pdo): int
{
    return (int)$pdo->query("SELECT val FROM meta WHERE name = 'seq'")->fetchColumn();
}

function begin(PDO $pdo): void
{
    if (isMysql($pdo)) {
        $pdo->beginTransaction();
    } else {
        // SQLite は書き込みロックを最初に取る（同時書き込みでの行き違いを防ぐ）
        $pdo->exec('BEGIN IMMEDIATE');
    }
}

// SQLite の BEGIN IMMEDIATE は PDO のトランザクション管理の外なので、終わらせ方も合わせる
function commit(PDO $pdo): void
{
    if (isMysql($pdo)) $pdo->commit();
    else $pdo->exec('COMMIT');
}

function rollback(PDO $pdo): void
{
    try {
        if (isMysql($pdo)) { if ($pdo->inTransaction()) $pdo->rollBack(); }
        else $pdo->exec('ROLLBACK');
    } catch (Throwable $e) {
        // トランザクションが始まっていなければ何もしない
    }
}

function isMysql(PDO $pdo): bool
{
    return $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
}

function dataDir(array $config): string
{
    return $config['data_dir'] ?? (__DIR__ . '/data');
}

function db(array $config): PDO
{
    static $pdo = null;
    if ($pdo) return $pdo;
    $opts = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 15];
    try {
        if (!empty($config['mysql']['host'])) {
            $m = $config['mysql'];
            $pdo = new PDO("mysql:host={$m['host']};dbname={$m['dbname']};charset=utf8mb4", $m['user'], $m['password'], $opts);
            $pdo->exec('CREATE TABLE IF NOT EXISTS kv (k VARCHAR(191) NOT NULL PRIMARY KEY, v MEDIUMTEXT NULL, seq BIGINT NOT NULL, INDEX idx_seq (seq)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
            $pdo->exec('CREATE TABLE IF NOT EXISTS meta (name VARCHAR(32) NOT NULL PRIMARY KEY, val BIGINT NOT NULL) ENGINE=InnoDB');
            $pdo->exec("INSERT IGNORE INTO meta (name, val) VALUES ('seq', 0)");
        } else {
            $dir = dataDir($config);
            if (!is_dir($dir)) mkdir($dir, 0700, true);
            $pdo = new PDO('sqlite:' . $dir . '/shinq.sqlite', null, null, $opts);
            $pdo->exec('PRAGMA journal_mode = WAL');
            $pdo->exec('PRAGMA busy_timeout = 15000');
            $pdo->exec('CREATE TABLE IF NOT EXISTS kv (k TEXT NOT NULL PRIMARY KEY, v TEXT NULL, seq INTEGER NOT NULL)');
            $pdo->exec('CREATE INDEX IF NOT EXISTS idx_seq ON kv (seq)');
            $pdo->exec('CREATE TABLE IF NOT EXISTS meta (name TEXT NOT NULL PRIMARY KEY, val INTEGER NOT NULL)');
            $pdo->exec("INSERT OR IGNORE INTO meta (name, val) VALUES ('seq', 0)");
        }
    } catch (Throwable $e) {
        fail(500, 'データベースに接続できません。config.php を確認してください。');
    }
    return $pdo;
}

/**
 * ログインの失敗回数を接続元ごとに数え、15分以内に10回間違えたら15分ロックする。
 * $result: null=確認だけ / false=失敗を記録 / true=成功（記録を消す）
 */
function loginGuard(array $config, ?bool $result = null): array
{
    $file = dataDir($config) . '/login_attempts.json';
    $ip = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|shinq');
    $now = time();
    $fp = @fopen($file, 'c+');
    if (!$fp) return ['locked' => false, 'minutes' => 0];
    flock($fp, LOCK_EX);
    $all = json_decode((string)stream_get_contents($fp), true) ?: [];
    foreach ($all as $k => $v) {
        if (($v['until'] ?? 0) < $now && ($v['first'] ?? 0) < $now - 900) unset($all[$k]); // 古い記録は消す
    }
    $me = $all[$ip] ?? ['count' => 0, 'first' => $now, 'until' => 0];
    if ($result === false) {
        if ($me['first'] < $now - 900) $me = ['count' => 0, 'first' => $now, 'until' => 0];
        $me['count']++;
        if ($me['count'] >= 10) $me['until'] = $now + 900;
        $all[$ip] = $me;
    } elseif ($result === true) {
        unset($all[$ip]);
    }
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($all));
    flock($fp, LOCK_UN);
    fclose($fp);
    $locked = ($me['until'] ?? 0) > $now && $result !== true;
    return ['locked' => $locked, 'minutes' => $locked ? (int)ceil(($me['until'] - $now) / 60) : 0];
}

/**
 * 内容書のメール送信。送信先は設定（shinq:settings の clinicMail）に登録されたアドレスに限る。
 */
function sendSheetMail(array $config, array $b): array
{
    $from = trim((string)($config['mail_from'] ?? ''));
    if (!filter_var($from, FILTER_VALIDATE_EMAIL)) {
        fail(500, 'メールの送り主が設定されていません（config.php の mail_from）');
    }
    $to = trim((string)($b['to'] ?? ''));
    $st = db($config)->prepare('SELECT v FROM kv WHERE k = ?');
    $st->execute(['shinq:settings']);
    $settings = json_decode((string)$st->fetchColumn(), true) ?: [];
    $allowed = array_map('strtolower', array_values(array_filter((array)($settings['clinicMail'] ?? []), 'is_string')));
    if (!filter_var($to, FILTER_VALIDATE_EMAIL) || !in_array(strtolower($to), $allowed, true)) {
        fail(400, '送信先が「設定」に登録されたアドレスではありません');
    }
    $pdf = base64_decode((string)($b['pdf'] ?? ''), true);
    if ($pdf === false || substr($pdf, 0, 5) !== '%PDF-' || strlen($pdf) > 8 * 1024 * 1024) {
        fail(400, '添付の PDF が正しくありません');
    }
    $clean = fn($v, $n) => mb_substr(str_replace(["\r", "\0"], '', (string)$v), 0, $n);
    $subject = trim(str_replace("\n", ' ', $clean($b['subject'] ?? '', 200))) ?: '鍼施術内容書';
    $text = $clean($b['body'] ?? '', 5000);
    $filename = preg_replace('#[\\\\/:*?"<>|\r\n]#u', '_', $clean($b['filename'] ?? 'naiyousho.pdf', 120));
    $fromName = trim($clean($config['mail_from_name'] ?? '', 60));

    $enc = fn($s) => '=?UTF-8?B?' . base64_encode($s) . '?=';
    $boundary = 'shinq_' . bin2hex(random_bytes(12));
    $headers = [
        'From: ' . ($fromName !== '' ? $enc($fromName) . ' ' : '') . '<' . $from . '>',
        'MIME-Version: 1.0',
        'Content-Type: multipart/mixed; boundary="' . $boundary . '"',
    ];
    if (filter_var($config['mail_bcc'] ?? '', FILTER_VALIDATE_EMAIL)) $headers[] = 'Bcc: ' . $config['mail_bcc'];
    $msg = "--$boundary\r\n"
        . "Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode(str_replace("\n", "\r\n", $text)))
        . "--$boundary\r\n"
        . "Content-Type: application/pdf; name=\"" . $enc($filename) . "\"\r\n"
        . "Content-Transfer-Encoding: base64\r\n"
        . "Content-Disposition: attachment; filename=\"" . $enc($filename) . "\"; filename*=UTF-8''" . rawurlencode($filename) . "\r\n\r\n"
        . chunk_split(base64_encode($pdf))
        . "--$boundary--\r\n";
    $ok = mail($to, $enc($subject), $msg, implode("\r\n", $headers), '-f' . $from);
    if (!$ok) fail(500, 'メールを送信できませんでした（サーバーのメール設定を確認してください）');
    return ['ok' => true];
}

function requireLogin(): void
{
    if (empty($_SESSION['ok'])) fail(401, 'login required');
    session_write_close(); // 以降はセッションを使わないので早めに解放（同時リクエストを待たせない）
}

function jsonBody(): array
{
    $b = json_decode((string)file_get_contents('php://input'), true);
    return is_array($b) ? $b : [];
}

function out(array $data): void
{
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(int $code, string $msg): void
{
    http_response_code($code);
    out(['error' => $msg]);
}
