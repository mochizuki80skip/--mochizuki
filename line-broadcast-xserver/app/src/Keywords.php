<?php
declare(strict_types=1);

/**
 * キーワード自動タグ付け。友だちが送ったテキストがルールに一致したら、タグを付ける（任意で自動返信）。
 * エリア別の登録 URL（メッセージ入力済みで開く URL）や、社員向けの合言葉に使う。
 */
final class Keywords
{
    /**
     * 全角/半角・大文字小文字・**空白（全角・半角・見えない空白を含む）の有無**の違いを吸収して比べる。
     * LINE の入力欄・トークでは、英数字と日本語の間に空白が入って見えることがあるため、空白はすべて無視する。
     */
    public static function normalize(string $s): string
    {
        $s = mb_convert_kana($s, 'asKV', 'UTF-8'); // 全角英数→半角、半角カナ→全角カナ
        $s = preg_replace('/[\s\x{00A0}\x{1680}\x{2000}-\x{200F}\x{2028}\x{2029}\x{202F}\x{205F}\x{2060}\x{3000}\x{FEFF}]+/u', '', $s) ?? $s;
        return mb_strtolower($s);
    }

    public static function matches(string $text, string $keyword, string $type): bool
    {
        $t = self::normalize($text);
        $k = self::normalize($keyword);
        if ($k === '') return false;
        return $type === 'contains' ? str_contains($t, $k) : $t === $k;
    }

    /**
     * 受信メッセージにルールを適用する。失敗しても Webhook 全体は止めない。
     * @return array{tagged:int[], replied:bool}
     */
    public static function apply(array $channel, int $friendId, string $text, ?string $replyToken): array
    {
        $result = ['tagged' => [], 'replied' => false];
        if (trim($text) === '') return $result;

        $replies = [];
        foreach (Db::all('SELECT * FROM keyword_rules WHERE channel_id = ? AND is_active = 1 ORDER BY id', [$channel['id']]) as $rule) {
            if (!self::matches($text, $rule['keyword'], $rule['match_type'])) continue;

            // 新しく付いたときだけ、タグ付与をきっかけにするステップ配信を開始する（同じ人に何度送られても重複しない）
            if (Db::exec('INSERT IGNORE INTO friend_tags (friend_id, tag_id, added_at) VALUES (?,?,?)', [$friendId, $rule['tag_id'], now_utc()]) > 0) {
                Scenarios::startForTag((int)$channel['id'], $friendId, (int)$rule['tag_id']);
            }
            $result['tagged'][] = (int)$rule['tag_id'];
            if ($rule['reply_text'] !== null && trim($rule['reply_text']) !== '') {
                $replies[$rule['reply_text']] = ['type' => 'text', 'text' => $rule['reply_text']];
            }
        }

        if ($replies && $replyToken) {
            try {
                Line::reply(Line::token($channel), $replyToken, array_slice(array_values($replies), 0, 5));
                $result['replied'] = true;
            } catch (Throwable $e) {
                error_log('[linehub] keyword reply failed: ' . $e->getMessage());
            }
        }
        return $result;
    }

    /** 友だち追加用の URL（メッセージ入力済みでトーク画面が開く）。$basicId は "@xxxxxxx" */
    public static function entryUrl(string $basicId, string $keyword): string
    {
        return 'https://line.me/R/oaMessage/' . $basicId . '/?' . rawurlencode($keyword);
    }
}
