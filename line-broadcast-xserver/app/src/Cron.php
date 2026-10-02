<?php
declare(strict_types=1);

/** 定期実行（予約配信・ステップ配信）。cron.php（CLI）と /cron（HTTP、任意）から呼ばれる */
final class Cron
{
    private static function stateFile(): string
    {
        return APP_DIR . '/storage/logs/last_cron.txt';
    }

    /** @return array{broadcasts:int, steps:int, recovered:int}|null 他のプロセスが実行中なら null */
    public static function run(): ?array
    {
        @set_time_limit(0);
        $lock = fopen(APP_DIR . '/storage/logs/cron.lock', 'c');
        if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) return null; // 前回の実行がまだ終わっていない

        try {
            $recovered = Broadcasts::recoverStale();
            $result = [
                'recovered' => $recovered,
                'broadcasts' => Broadcasts::dispatchScheduled(),
                'steps' => Scenarios::dispatchDue(),
            ];
            @file_put_contents(self::stateFile(), (string)time());
            return $result;
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    /** cron が最後に動いた時刻（UNIX 秒）。一度も動いていなければ null */
    public static function lastRun(): ?int
    {
        $f = self::stateFile();
        if (!is_file($f)) return null;
        $t = (int)trim((string)@file_get_contents($f));
        return $t > 0 ? $t : null;
    }
}
