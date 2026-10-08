<?php
declare(strict_types=1);

// 共通の起動処理。Web（public/index.php）と cron（cron.php）の両方から読み込まれる。

define('APP_DIR', __DIR__);
date_default_timezone_set('UTC'); // DB には UTC で保存し、表示時に日本時間へ変換する
mb_internal_encoding('UTF-8');

foreach (['helpers', 'Config', 'Db', 'Crypto', 'Auth', 'Line', 'Blocks', 'Broadcasts', 'Campaigns', 'Scenarios', 'View', 'Router', 'Cron', 'Migrator', 'Keywords', 'Analytics'] as $f) {
    require_once APP_DIR . '/src/' . $f . '.php';
}

set_exception_handler(function (Throwable $e): void {
    error_log('[linehub] ' . $e);
    if (PHP_SAPI === 'cli') {
        fwrite(STDERR, $e->getMessage() . "\n");
        exit(1);
    }
    http_response_code(500);
    $debug = Config::get('debug', false);
    $isApi = isset($_SERVER['REQUEST_URI']) && str_contains((string)$_SERVER['REQUEST_URI'], '/api/');
    if ($isApi) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => $debug ? $e->getMessage() : 'サーバーエラーが発生しました'], JSON_UNESCAPED_UNICODE);
    } else {
        echo $debug ? '<pre>' . htmlspecialchars((string)$e) . '</pre>' : 'サーバーエラーが発生しました。しばらくしてからやり直してください。';
    }
});
