<?php
declare(strict_types=1);

/** アカウント 1 つ分の配信（broadcasts 行）の実行 */
final class Broadcasts
{
    /** 送信中のまま止まっているとみなす経過分数 */
    public const STALE_MINUTES = 15;

    /**
     * 配信を実行する。draft / scheduled の行だけを「送信中」に切り替えて確保するので、
     * 手動実行と cron が重なっても二重送信しない。
     * @return array{ok:bool, error?:string}
     */
    public static function execute(int $id): array
    {
        $claimed = Db::exec(
            "UPDATE broadcasts SET status = 'sending', started_at = ? WHERE id = ? AND status IN ('draft','scheduled')",
            [now_utc(), $id]
        );
        if ($claimed === 0) return ['ok' => false, 'error' => 'この配信はすでに処理されています'];

        $b = Db::one('SELECT * FROM broadcasts WHERE id = ?', [$id]);
        try {
            $channel = Db::one('SELECT * FROM line_channels WHERE id = ?', [$b['channel_id']]);
            if (!$channel || !(int)$channel['is_active']) throw new RuntimeException('アカウントが無効、または削除されています');
            $token = Line::token($channel);
            $messages = json_decode($b['messages'], true);

            if ((int)$b['target_all']) {
                $count = (int)Db::val('SELECT COUNT(*) FROM friends WHERE channel_id = ? AND is_following = 1', [$channel['id']]);
                $requestId = Line::broadcast($token, $messages);
                if ($requestId) {
                    Db::exec('INSERT INTO broadcast_insights (broadcast_id, request_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE request_id = VALUES(request_id)', [$id, $requestId]);
                }
                self::finish($id, 'sent', $count, $count, 0, null);
                return ['ok' => true];
            }

            $userIds = array_column(Db::all(
                'SELECT DISTINCT f.line_user_id FROM friends f JOIN friend_tags ft ON ft.friend_id = f.id
                 WHERE f.channel_id = ? AND f.is_following = 1
                   AND ft.tag_id IN (SELECT tag_id FROM broadcast_tags WHERE broadcast_id = ?)',
                [$channel['id'], $id]
            ), 'line_user_id');

            $ok = 0;
            $ng = 0;
            $errors = [];
            foreach (array_chunk($userIds, Line::MULTICAST_LIMIT) as $chunk) {
                try {
                    Line::multicast($token, $chunk, $messages);
                    $ok += count($chunk);
                } catch (LineException $e) {
                    $ng += count($chunk);
                    $errors[] = $e->getMessage();
                }
            }
            $note = $errors ? implode("\n", array_unique($errors)) : (count($userIds) === 0 ? '対象の友だちがいなかったため送信していません' : null);
            self::finish($id, $ng > 0 ? 'failed' : 'sent', count($userIds), $ok, $ng, $note);
            return $ng > 0 ? ['ok' => false, 'error' => $note] : ['ok' => true];
        } catch (Throwable $e) {
            self::finish($id, 'failed', 0, 0, 0, $e->getMessage());
            return ['ok' => false, 'error' => $e->getMessage()];
        }
    }

    private static function finish(int $id, string $status, int $total, int $ok, int $ng, ?string $error): void
    {
        Db::exec(
            'UPDATE broadcasts SET status = ?, sent_at = ?, total_targets = ?, success_count = ?, failure_count = ?, error_message = ? WHERE id = ?',
            [$status, now_utc(), $total, $ok, $ng, $error, $id]
        );
    }

    /** 予約時刻を過ぎた配信を実行する（cron から呼ばれる） */
    public static function dispatchScheduled(): int
    {
        $due = Db::all("SELECT id FROM broadcasts WHERE status = 'scheduled' AND scheduled_at <= ? ORDER BY scheduled_at LIMIT 50", [now_utc()]);
        foreach ($due as $row) {
            self::execute((int)$row['id']);
        }
        return count($due);
    }

    /**
     * 「送信中」のまま長時間止まっている配信を失敗扱いにする。
     * LINE 側では配信済みの可能性があるため、自動での再送はしない（二重配信防止）。
     */
    public static function recoverStale(): int
    {
        return Db::exec(
            "UPDATE broadcasts SET status = 'failed', error_message = ? WHERE status = 'sending' AND started_at < ?",
            ['送信中に処理が中断されました。LINE 側で配信済みの可能性があるため自動再送していません。内容を確認してください。', gmdate('Y-m-d H:i:s', time() - self::STALE_MINUTES * 60)]
        );
    }
}
