<?php
declare(strict_types=1);

/** LINE のアクセストークン等を DB に平文で置かないための暗号化（AES-256-GCM）。鍵は config.php の app_key */
final class Crypto
{
    private static function key(): string
    {
        $k = base64_decode((string)Config::get('app_key', ''), true);
        if ($k === false || strlen($k) !== 32) {
            throw new RuntimeException('config.php の app_key が正しく設定されていません');
        }
        return $k;
    }

    public static function generateKey(): string
    {
        return base64_encode(random_bytes(32));
    }

    public static function encrypt(string $plain): string
    {
        $iv = random_bytes(12);
        $tag = '';
        $ct = openssl_encrypt($plain, 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, $iv, $tag);
        if ($ct === false) throw new RuntimeException('暗号化に失敗しました');
        return 'v1:' . base64_encode($iv . $tag . $ct);
    }

    public static function decrypt(string $stored): string
    {
        if (!str_starts_with($stored, 'v1:')) throw new RuntimeException('不明な暗号形式です');
        $raw = base64_decode(substr($stored, 3), true);
        if ($raw === false || strlen($raw) < 28) throw new RuntimeException('暗号データが壊れています');
        $pt = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16));
        if ($pt === false) throw new RuntimeException('復号に失敗しました（app_key が変わっていないか確認してください）');
        return $pt;
    }
}
