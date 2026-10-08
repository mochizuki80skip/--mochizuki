<?php
declare(strict_types=1);

// フロントコントローラ。すべてのリクエストがここに集まる（public/.htaccess で転送）。
// アプリ本体は 1 つ上の app/ にある（Web から直接見えない場所）。
$appDir = is_dir(__DIR__ . '/../app') ? __DIR__ . '/../app' : __DIR__ . '/app';
if (!is_file($appDir . '/bootstrap.php')) {
    http_response_code(500);
    exit('app フォルダが見つかりません。public と同じ階層に app フォルダを置いてください。');
}

require $appDir . '/bootstrap.php';

// サブディレクトリ設置（例: https://example.com/line/）にも対応
define('BASE_PATH', detect_base_path(__DIR__));

if (!Config::exists()) {
    header('Location: ' . BASE_PATH . '/install.php');
    exit;
}

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
if (BASE_PATH !== '' && str_starts_with($path, BASE_PATH)) $path = substr($path, strlen(BASE_PATH));
$path = '/' . ltrim(rawurldecode($path), '/');
if ($path === '/index.php') $path = '/';

// データベースの自動更新（新しいバージョンのファイルを上げただけで、必要なテーブルが追加される）
Migrator::run();

// 検索エンジンに載せない（すべての応答に付ける）
header('X-Robots-Tag: noindex, nofollow, noarchive');

// LINE からの Webhook・画像取得・cron は外部から届く必要がある（アクセスキー不要）
$isPublicEndpoint = str_starts_with($path, '/webhook/') || str_starts_with($path, '/media/') || str_starts_with($path, '/r/') || $path === '/cron';

// アクセスキーによる入口の保護: URL を知っている人（キー付き URL を開いた端末）だけが画面にたどり着ける。
// 知らない人には「存在しないサイト」と同じ 404 を返す。キーは config.php の access_key（空なら無効）。
$gateKey = (string)Config::get('access_key', '');
if ($gateKey !== '' && !$isPublicEndpoint) {
    $cookieValue = hash_hmac('sha256', 'linehub-gate', $gateKey);
    $given = $_GET['k'] ?? null;
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    if (is_string($given) && hash_equals($gateKey, $given)) {
        // 正しいキー付き URL → この端末に通行証（Cookie）を渡して、キーを消した URL へ移動
        setcookie('lhgate', $cookieValue, [
            'expires' => time() + 86400 * 365, 'path' => BASE_PATH . '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Lax',
        ]);
        $q = $_GET;
        unset($q['k']);
        header('Location: ' . BASE_PATH . ($path === '/' ? '/' : $path) . ($q ? '?' . http_build_query($q) : ''));
        exit;
    }
    if (!hash_equals($cookieValue, (string)($_COOKIE['lhgate'] ?? ''))) {
        http_response_code(404);
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-store');
        echo "<!DOCTYPE HTML PUBLIC \"-//IETF//DTD HTML 2.0//EN\">\n<html><head><title>404 Not Found</title></head><body>\n<h1>Not Found</h1>\n<p>The requested URL was not found on this server.</p>\n</body></html>";
        exit;
    }
}

// セッションは Webhook・画像・cron では不要
$noSession = $isPublicEndpoint;
if (!$noSession) Auth::startSession();

// セキュリティヘッダ
header('X-Frame-Options: SAMEORIGIN');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
if (!str_starts_with($path, '/media/')) header('Cache-Control: no-store');

foreach (glob($appDir . '/routes/*.php') as $routeFile) {
    require $routeFile;
}

Router::dispatch($_SERVER['REQUEST_METHOD'] ?? 'GET', $path);
