<?php
declare(strict_types=1);

/** LINE のメッセージ配信数（月の上限と今月の消費）の取得・保存・表示用の整形 */
final class Quota
{
    /** この分数より古い控えは、cron が取り直す */
    public const TTL_MINUTES = 10;

    /** LINE から取得して保存する。失敗しても例外は投げず、エラー内容を控える。 */
    public static function refresh(array $channel): array
    {
        $limitType = $limit = $used = $error = null;
        try {
            $token = Line::token($channel);
            $q = Line::quota($token);
            $limitType = (string)($q['type'] ?? '');
            $limit = isset($q['value']) ? (int)$q['value'] : null;
            $used = (int)(Line::quotaConsumption($token)['totalUsage'] ?? 0);
        } catch (Throwable $e) {
            $error = mb_substr($e->getMessage(), 0, 250);
        }
        Db::exec(
            'INSERT INTO channel_quota (channel_id, limit_type, limit_value, used, error, fetched_at) VALUES (?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE
               limit_type = IF(VALUES(error) IS NULL, VALUES(limit_type), limit_type),
               limit_value = IF(VALUES(error) IS NULL, VALUES(limit_value), limit_value),
               used = IF(VALUES(error) IS NULL, VALUES(used), used),
               error = VALUES(error), fetched_at = VALUES(fetched_at)',
            [$channel['id'], $limitType, $limit, $used, $error, now_utc()]
        );
        return self::forChannels([(int)$channel['id']])[(int)$channel['id']] ?? [];
    }

    /** 控えが古い（または無い）有効なアカウントの分を取り直す（cron から） */
    public static function refreshStale(int $max = 10): int
    {
        $rows = Db::all(
            'SELECT c.* FROM line_channels c LEFT JOIN channel_quota q ON q.channel_id = c.id
              WHERE c.is_active = 1 AND (q.channel_id IS NULL OR q.fetched_at < ?)
              ORDER BY q.fetched_at IS NOT NULL, q.fetched_at LIMIT ' . (int)$max,
            [gmdate('Y-m-d H:i:s', time() - self::TTL_MINUTES * 60)]
        );
        foreach ($rows as $ch) self::refresh($ch);
        return count($rows);
    }

    /**
     * 画面用の値。remaining は上限が無い（従量課金など）とき null。
     * @param int[] $channelIds
     * @return array<int,array{type:?string,limit:?int,used:?int,remaining:?int,unlimited:bool,error:?string,fetchedAt:?string}>
     */
    public static function forChannels(array $channelIds): array
    {
        if (!$channelIds) return [];
        $out = [];
        foreach (Db::all('SELECT * FROM channel_quota WHERE channel_id IN (' . Db::in($channelIds) . ')', array_values($channelIds)) as $r) {
            $limited = $r['limit_type'] === 'limited' && $r['limit_value'] !== null;
            $out[(int)$r['channel_id']] = [
                'type' => $r['limit_type'],
                'limit' => $limited ? (int)$r['limit_value'] : null,
                'used' => $r['used'] === null ? null : (int)$r['used'],
                'remaining' => ($limited && $r['used'] !== null) ? max(0, (int)$r['limit_value'] - (int)$r['used']) : null,
                'unlimited' => $r['limit_type'] === 'none',
                'error' => $r['error'],
                'fetchedAt' => $r['fetched_at'],
            ];
        }
        return $out;
    }
}
