<?php
declare(strict_types=1);

/** HTML エスケープ */
function h(?string $s): string
{
    return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** アプリ内URL（サブディレクトリ設置にも対応） */
function url(string $path = ''): string
{
    return (defined('BASE_PATH') ? BASE_PATH : '') . $path;
}

function asset(string $path): string
{
    $file = dirname(APP_DIR) . '/public/assets/' . $path;
    $v = is_file($file) ? (string)filemtime($file) : '1';
    return url('/assets/' . $path) . '?v=' . $v;
}

function now_utc(): string
{
    return gmdate('Y-m-d H:i:s');
}

/** UTC の DB 日時 → 日本時間の表示文字列 */
function fmt_jst(?string $utc, bool $withTime = true): string
{
    if (!$utc) return '-';
    $d = new DateTimeImmutable($utc, new DateTimeZone('UTC'));
    return $d->setTimezone(new DateTimeZone('Asia/Tokyo'))->format($withTime ? 'Y/m/d H:i' : 'Y/m/d');
}

/** ISO 8601 / 任意の日時文字列 → UTC の DB 日時。不正なら null */
function to_utc(string $s): ?string
{
    try {
        return (new DateTimeImmutable($s))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    } catch (Throwable) {
        return null;
    }
}

function json_out(array $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_error(string $message, int $status = 400): never
{
    json_out(['error' => $message], $status);
}

/** JSON リクエストボディ（不正なら null） */
function json_body(): ?array
{
    $raw = file_get_contents('php://input');
    $d = json_decode($raw === false ? '' : $raw, true);
    return is_array($d) ? $d : null;
}

function redirect(string $path): never
{
    header('Location: ' . url($path));
    exit;
}

function flash(?string $message = null, string $type = 'info'): ?array
{
    if ($message !== null) {
        $_SESSION['flash'] = ['message' => $message, 'type' => $type];
        return null;
    }
    $f = $_SESSION['flash'] ?? null;
    unset($_SESSION['flash']);
    return $f;
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="_csrf" value="' . h(csrf_token()) . '">';
}

/** このシステムの公開URL（画像の取得先などに使う） */
function public_base_url(): string
{
    $cfg = trim((string)Config::get('base_url', ''));
    if ($cfg !== '') return rtrim($cfg, '/');
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    return ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . (defined('BASE_PATH') ? BASE_PATH : '');
}

function new_uuid(): string
{
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}

function str_trunc(string $s, int $len): string
{
    return mb_strlen($s) > $len ? mb_substr($s, 0, $len) . '…' : $s;
}

/**
 * このシステムを設置したフォルダの URL パス（例: ドメイン直下なら ""、https://example.com/line/ なら "/line"）。
 * SCRIPT_NAME は .htaccess の書き換えで当てにならないため、ドキュメントルートとの位置関係から求める。
 */
function detect_base_path(string $publicDir): string
{
    $doc = realpath((string)($_SERVER['DOCUMENT_ROOT'] ?? ''));
    $dir = realpath($publicDir);
    if ($doc && $dir && ($dir === $doc || str_starts_with($dir, $doc . DIRECTORY_SEPARATOR))) {
        return rtrim(str_replace('\\', '/', substr($dir, strlen($doc))), '/');
    }
    return rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
}
