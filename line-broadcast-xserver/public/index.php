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

// LINE からの Webhook・画像取得・cron はセッション不要
$noSession = str_starts_with($path, '/webhook/') || str_starts_with($path, '/media/') || $path === '/cron';
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
