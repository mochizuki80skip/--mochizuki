<?php
declare(strict_types=1);

final class LineException extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 0)
    {
        parent::__construct($message);
    }
}

/** LINE Messaging API の薄いクライアント（cURL のみ使用、外部ライブラリ不要） */
final class Line
{
    public const MULTICAST_LIMIT = 500;

    private static function base(): string
    {
        return rtrim((string)Config::get('line_api_base', 'https://api.line.me'), '/');
    }

    /** @return array{status:int, body:?array} */
    public static function request(string $token, string $method, string $path, ?array $body = null, bool $idempotent = false): array
    {
        $retryKey = $idempotent ? new_uuid() : null; // 再試行しても二重送信にならないようにする LINE の仕組み
        $attempts = $idempotent ? 3 : 1;
        $last = ['status' => 0, 'body' => null, 'error' => ''];

        for ($i = 0; $i < $attempts; $i++) {
            if ($i > 0) sleep($i);
            $ch = curl_init(self::base() . $path);
            $headers = ['Authorization: Bearer ' . $token, 'Content-Type: application/json'];
            if ($retryKey) $headers[] = 'X-Line-Retry-Key: ' . $retryKey;
            curl_setopt_array($ch, [
                CURLOPT_CUSTOMREQUEST => $method,
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 30,
                CURLOPT_CONNECTTIMEOUT => 10,
            ]);
            if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
            $raw = curl_exec($ch);
            $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $err = curl_error($ch);
            curl_close($ch);

            $decoded = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;
            $last = ['status' => $status, 'body' => is_array($decoded) ? $decoded : null, 'error' => $err];
            if ($status === 409 && $retryKey) return ['status' => 200, 'body' => null]; // 同じキーで受付済み = 成功
            if ($status >= 200 && $status < 300) return ['status' => $status, 'body' => $last['body']];
            if ($status !== 0 && $status < 500) break; // 4xx は再試行しても無駄
        }

        $msg = $last['body']['message'] ?? ($last['error'] ?: 'HTTP ' . $last['status']);
        if (!empty($last['body']['details'])) {
            $msg .= ' (' . implode(', ', array_map(fn($d) => ($d['property'] ?? '') . ': ' . ($d['message'] ?? ''), $last['body']['details'])) . ')';
        }
        throw new LineException((string)$msg, $last['status']);
    }

    public static function botInfo(string $token): array
    {
        return self::request($token, 'GET', '/v2/bot/info')['body'] ?? [];
    }

    public static function profile(string $token, string $userId): ?array
    {
        try {
            return self::request($token, 'GET', '/v2/bot/profile/' . rawurlencode($userId))['body'];
        } catch (LineException) {
            return null;
        }
    }

    public static function broadcast(string $token, array $messages): void
    {
        self::request($token, 'POST', '/v2/bot/message/broadcast', ['messages' => $messages], true);
    }

    public static function multicast(string $token, array $userIds, array $messages): void
    {
        self::request($token, 'POST', '/v2/bot/message/multicast', ['to' => array_values($userIds), 'messages' => $messages], true);
    }

    /** 受信メッセージへの返信（replyToken は受信から 1 分程度で失効する） */
    public static function reply(string $token, string $replyToken, array $messages): void
    {
        self::request($token, 'POST', '/v2/bot/message/reply', ['replyToken' => $replyToken, 'messages' => $messages]);
    }

    public static function push(string $token, string $userId, array $messages): void
    {
        self::request($token, 'POST', '/v2/bot/message/push', ['to' => $userId, 'messages' => $messages], true);
    }

    /** Webhook の署名検証（HMAC-SHA256 を base64 にしたものと x-line-signature を比較） */
    public static function verifySignature(string $rawBody, ?string $signature, string $secret): bool
    {
        if (!$signature) return false;
        return hash_equals(base64_encode(hash_hmac('sha256', $rawBody, $secret, true)), $signature);
    }

    public static function token(array $channel): string
    {
        return Crypto::decrypt($channel['access_token']);
    }

    public static function secret(array $channel): string
    {
        return Crypto::decrypt($channel['channel_secret']);
    }
}
