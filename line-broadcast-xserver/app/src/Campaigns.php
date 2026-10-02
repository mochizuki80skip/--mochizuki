<?php
declare(strict_types=1);

/** 一括配信（1 回の指示 → 選択アカウントごとの broadcasts へ展開） */
final class Campaigns
{
    public const STATUS_LABEL = [
        'draft' => '下書き', 'scheduled' => '予約済', 'sending' => '送信中', 'sent' => '送信済',
        'partial' => '一部失敗', 'failed' => '失敗', 'cancelled' => '取消', 'skipped' => '対象なし',
    ];

    /**
     * @param array $in title, blocks, channelIds, tagNames, mode(now|schedule|draft), scheduledAt
     * @return int 作成した campaign の id（mode=now の場合は作成後に即時実行まで行う）
     * @throws ValidationError
     */
    public static function create(array $user, array $in): int
    {
        $title = trim((string)($in['title'] ?? ''));
        if ($title === '') throw new ValidationError('タイトルを入力してください');
        if (mb_strlen($title) > 120) throw new ValidationError('タイトルは 120 文字以内にしてください');

        $mode = $in['mode'] ?? '';
        if (!in_array($mode, ['now', 'schedule', 'draft'], true)) throw new ValidationError('配信方法が不正です');

        $scheduledAt = null;
        if ($mode === 'schedule') {
            $scheduledAt = to_utc((string)($in['scheduledAt'] ?? ''));
            if (!$scheduledAt) throw new ValidationError('配信日時を指定してください');
            if (strtotime($scheduledAt . ' UTC') < time() - 60) throw new ValidationError('配信日時が過去です');
        }

        $channelIds = array_values(array_unique(array_map('intval', is_array($in['channelIds'] ?? null) ? $in['channelIds'] : [])));
        if (!$channelIds) throw new ValidationError('配信するアカウントを選択してください');
        if (count($channelIds) > 50) throw new ValidationError('一度に選択できるアカウントは 50 までです');
        // 権限のないアカウントを指定されても弾く（画面の選択肢を信用しない）
        if (array_diff($channelIds, Auth::channelIds())) throw new ValidationError('権限のないアカウントが含まれています', 403);

        $tagNames = [];
        foreach (is_array($in['tagNames'] ?? null) ? $in['tagNames'] : [] as $t) {
            $t = trim((string)$t);
            if ($t !== '') $tagNames[$t] = true;
        }
        $tagNames = array_keys($tagNames);

        $blocks = Blocks::validate($in['blocks'] ?? null);
        $messages = Blocks::build($blocks, public_base_url());

        $tagsByChannel = [];
        if ($tagNames) {
            $rows = Db::all(
                'SELECT id, name, channel_id FROM tags WHERE channel_id IN (' . Db::in($channelIds) . ') AND name IN (' . Db::in($tagNames) . ')',
                array_merge($channelIds, $tagNames)
            );
            foreach ($rows as $r) $tagsByChannel[(int)$r['channel_id']][] = (int)$r['id'];
        }

        $campaignId = Db::tx(function () use ($user, $title, $blocks, $messages, $tagNames, $scheduledAt, $channelIds, $mode, $tagsByChannel) {
            $cid = Db::insert(
                'INSERT INTO campaigns (title, blocks, messages, audience_tag_names, scheduled_at, created_by, created_at) VALUES (?,?,?,?,?,?,?)',
                [$title, json_encode($blocks, JSON_UNESCAPED_UNICODE), json_encode($messages, JSON_UNESCAPED_UNICODE),
                    json_encode($tagNames, JSON_UNESCAPED_UNICODE), $scheduledAt, $user['id'], now_utc()]
            );
            foreach ($channelIds as $ch) {
                $tagIds = $tagsByChannel[$ch] ?? [];
                // タグ指定なのに該当タグが無いアカウントは、全員に送ってしまわないよう「対象なし」にする
                $noAudience = $tagNames && !$tagIds;
                $status = $noAudience ? 'skipped' : ($mode === 'schedule' ? 'scheduled' : 'draft');
                $bid = Db::insert(
                    'INSERT INTO broadcasts (campaign_id, channel_id, title, messages, status, target_all, scheduled_at, error_message, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
                    [$cid, $ch, $title, json_encode($messages, JSON_UNESCAPED_UNICODE), $status, $tagNames ? 0 : 1, $scheduledAt,
                        $noAudience ? '指定したタグがこのアカウントに存在しないため配信しませんでした' : null, now_utc()]
                );
                foreach ($tagIds as $tid) {
                    Db::exec('INSERT INTO broadcast_tags (broadcast_id, tag_id) VALUES (?, ?)', [$bid, $tid]);
                }
            }
            return $cid;
        });

        if ($mode === 'now') self::executeAll($campaignId, $channelIds);
        return (int)$campaignId;
    }

    /** 未送信（下書き/予約）の配信を、アカウントごとに実行する。@return array<int,array> channel_id => 結果 */
    public static function executeAll(int $campaignId, ?array $allowedChannelIds = null): array
    {
        @set_time_limit(300);
        $sql = "SELECT id, channel_id FROM broadcasts WHERE campaign_id = ? AND status IN ('draft','scheduled')";
        $params = [$campaignId];
        if ($allowedChannelIds !== null) {
            $sql .= ' AND channel_id IN (' . Db::in($allowedChannelIds) . ')';
            $params = array_merge($params, $allowedChannelIds);
        }
        $results = [];
        foreach (Db::all($sql, $params) as $row) {
            $results[(int)$row['channel_id']] = Broadcasts::execute((int)$row['id']);
        }
        return $results;
    }

    public static function cancel(int $campaignId, ?array $allowedChannelIds = null): int
    {
        $sql = "UPDATE broadcasts SET status = 'cancelled' WHERE campaign_id = ? AND status IN ('draft','scheduled')";
        $params = [$campaignId];
        if ($allowedChannelIds !== null) {
            $sql .= ' AND channel_id IN (' . Db::in($allowedChannelIds) . ')';
            $params = array_merge($params, $allowedChannelIds);
        }
        return Db::exec($sql, $params);
    }

    /** 子配信の状態からキャンペーン全体の表示状態を決める */
    public static function summarize(array $statuses): string
    {
        if (!$statuses) return 'draft';
        foreach (['sending', 'scheduled', 'draft'] as $s) {
            if (in_array($s, $statuses, true)) return $s;
        }
        $done = count(array_filter($statuses, fn($s) => $s === 'sent'));
        $bad = count(array_filter($statuses, fn($s) => $s === 'failed'));
        if ($bad && $done) return 'partial';
        if ($bad) return 'failed';
        if ($done) return 'sent';
        return 'cancelled';
    }
}
