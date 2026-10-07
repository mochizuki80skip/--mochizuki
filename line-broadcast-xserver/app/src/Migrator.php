<?php
declare(strict_types=1);

/**
 * データベースの自動更新。app/migrations/*.sql のうち未適用のものを、ファイル名順に 1 回だけ実行する。
 * （機能追加でテーブルが増えても、FTP で新しいファイルを上げるだけで、画面を開いたときに自動で反映される）
 * migrations の SQL は何度実行しても安全（CREATE TABLE IF NOT EXISTS 等）に書くこと。
 */
final class Migrator
{
    public static function run(): void
    {
        try {
            $done = array_column(Db::all('SELECT name FROM schema_migrations'), 'name');
        } catch (PDOException) {
            Db::exec('CREATE TABLE IF NOT EXISTS schema_migrations (
                name VARCHAR(100) NOT NULL PRIMARY KEY, applied_at DATETIME NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
            $done = [];
        }
        $files = glob(APP_DIR . '/migrations/*.sql') ?: [];
        sort($files);
        foreach ($files as $file) {
            $name = basename($file);
            if (in_array($name, $done, true)) continue;
            foreach (preg_split('/;\s*\n/', (string)file_get_contents($file)) as $stmt) {
                $stmt = trim(preg_replace('/^--.*$/m', '', $stmt));
                if ($stmt !== '') Db::pdo()->exec($stmt);
            }
            Db::exec('INSERT IGNORE INTO schema_migrations (name, applied_at) VALUES (?, ?)', [$name, now_utc()]);
        }
    }
}
