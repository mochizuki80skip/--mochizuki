<?php
declare(strict_types=1);

final class Config
{
    private static ?array $data = null;

    public static function load(): array
    {
        if (self::$data === null) {
            $file = APP_DIR . '/config.php';
            self::$data = is_file($file) ? (require $file) : [];
        }
        return self::$data;
    }

    public static function exists(): bool
    {
        return is_file(APP_DIR . '/config.php');
    }

    /** ドット区切りで取得（例: 'db.host'） */
    public static function get(string $key, mixed $default = null): mixed
    {
        $v = self::load();
        foreach (explode('.', $key) as $part) {
            if (!is_array($v) || !array_key_exists($part, $v)) return $default;
            $v = $v[$part];
        }
        return $v;
    }
}
