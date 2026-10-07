<?php
declare(strict_types=1);

// 定期実行用スクリプト。Xserver のサーバーパネル「Cron設定」から 1 分ごとに実行します。
//   /usr/bin/php8.2 /home/ユーザー名/ドメイン/app/cron.php
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require __DIR__ . '/bootstrap.php';

Migrator::run();
$r = Cron::run();
if ($r === null) {
    echo date('c') . " skipped (already running)\n";
    exit(0);
}
echo date('c') . " broadcasts={$r['broadcasts']} steps={$r['steps']} recovered={$r['recovered']}\n";
