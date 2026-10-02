<?php
declare(strict_types=1);

/** ステップ配信（友だち追加・タグ付与をきっかけに、メッセージを順番に自動配信） */
final class Scenarios
{
    public const MAX_STEPS = 30;

    // ---- 開始 ----

    public static function startForFollow(int $channelId, int $friendId): void
    {
        foreach (Db::all("SELECT id FROM scenarios WHERE channel_id = ? AND trigger_type = 'follow' AND is_active = 1", [$channelId]) as $s) {
            self::startForFriend((int)$s['id'], $friendId);
        }
    }

    public static function startForTag(int $channelId, int $friendId, int $tagId): void
    {
        foreach (Db::all("SELECT id FROM scenarios WHERE channel_id = ? AND trigger_type = 'tag_added' AND trigger_tag_id = ? AND is_active = 1", [$channelId, $tagId]) as $s) {
            self::startForFriend((int)$s['id'], $friendId);
        }
    }

    /** 同じ人に同じシナリオは 1 回だけ（scenario_runs の一意制約で保証） */
    public static function startForFriend(int $scenarioId, int $friendId): void
    {
        $steps = Db::all('SELECT id, delay_minutes, send_time FROM scenario_steps WHERE scenario_id = ? ORDER BY step_order', [$scenarioId]);
        if (!$steps) return;
        Db::tx(function () use ($scenarioId, $friendId, $steps) {
            $n = Db::exec("INSERT IGNORE INTO scenario_runs (scenario_id, friend_id, started_at, status) VALUES (?, ?, ?, 'running')", [$scenarioId, $friendId, now_utc()]);
            if ($n === 0) return;
            $runId = (int)Db::pdo()->lastInsertId();
            $cursor = new DateTimeImmutable('now', new DateTimeZone('UTC'));
            foreach ($steps as $st) {
                $cursor = self::computeStepTime($cursor, (int)$st['delay_minutes'], $st['send_time']);
                Db::exec("INSERT INTO scenario_run_steps (run_id, step_id, scheduled_at, status) VALUES (?, ?, ?, 'pending')", [$runId, $st['id'], $cursor->format('Y-m-d H:i:s')]);
            }
        });
    }

    /**
     * 各ステップの送信予定時刻。起点 $prev は直前ステップの送信予定。
     *  - $sendTime なし: $prev + $delayMinutes
     *  - $sendTime あり: $prev の日付（日本時間）の $delayMinutes/1440 日後の HH:mm。
     *    0 日後で既にその時刻を過ぎていれば $prev（=すぐ）
     */
    public static function computeStepTime(DateTimeImmutable $prev, int $delayMinutes, ?string $sendTime): DateTimeImmutable
    {
        if (!$sendTime || !preg_match('/^([01]\d|2[0-3]):([0-5]\d)$/', $sendTime, $m)) {
            return $prev->modify("+{$delayMinutes} minutes");
        }
        $jst = new DateTimeZone('Asia/Tokyo');
        $days = intdiv($delayMinutes, 1440);
        $target = $prev->setTimezone($jst)->setTime((int)$m[1], (int)$m[2], 0)->modify("+{$days} days")->setTimezone(new DateTimeZone('UTC'));
        return $target < $prev ? $prev : $target;
    }

    // ---- 送信（cron） ----

    public static function dispatchDue(): int
    {
        $now = now_utc();
        // 送信中のまま止まった行は失敗扱い（二重送信を避けるため再送しない）
        Db::exec(
            "UPDATE scenario_run_steps SET status = 'failed', error_message = ? WHERE status = 'sending' AND started_at < ?",
            ['送信中に処理が中断されました（自動再送なし）', gmdate('Y-m-d H:i:s', time() - Broadcasts::STALE_MINUTES * 60)]
        );

        $due = Db::all(
            "SELECT rs.id, st.messages, f.line_user_id, f.is_following, f.channel_id
               FROM scenario_run_steps rs
               JOIN scenario_steps st ON st.id = rs.step_id
               JOIN scenario_runs r ON r.id = rs.run_id
               JOIN friends f ON f.id = r.friend_id
              WHERE rs.status = 'pending' AND rs.scheduled_at <= ?
              ORDER BY rs.scheduled_at LIMIT 200",
            [$now]
        );
        $channels = [];
        foreach ($due as $row) {
            $id = (int)$row['id'];
            if (Db::exec("UPDATE scenario_run_steps SET status = 'sending', started_at = ? WHERE id = ? AND status = 'pending'", [now_utc(), $id]) === 0) continue;

            if (!(int)$row['is_following']) {
                self::mark($id, 'skipped', 'ブロック中または友だち解除済み');
                continue;
            }
            $cid = (int)$row['channel_id'];
            $channels[$cid] ??= Db::one('SELECT * FROM line_channels WHERE id = ?', [$cid]);
            $ch = $channels[$cid];
            if (!$ch || !(int)$ch['is_active']) {
                self::mark($id, 'skipped', 'アカウントが無効です');
                continue;
            }
            try {
                Line::push(Line::token($ch), $row['line_user_id'], json_decode($row['messages'], true));
                self::mark($id, 'sent', null);
            } catch (Throwable $e) {
                self::mark($id, 'failed', $e->getMessage());
            }
        }

        Db::exec(
            "UPDATE scenario_runs r SET status = 'completed', finished_at = ?
              WHERE r.status = 'running'
                AND NOT EXISTS (SELECT 1 FROM scenario_run_steps s WHERE s.run_id = r.id AND s.status IN ('pending','sending'))",
            [now_utc()]
        );
        return count($due);
    }

    private static function mark(int $id, string $status, ?string $error): void
    {
        Db::exec('UPDATE scenario_run_steps SET status = ?, sent_at = ?, error_message = ? WHERE id = ?', [$status, now_utc(), $error, $id]);
    }

    // ---- 入力検証・保存 ----

    /** @return array 正規化済みの入力。@throws ValidationError */
    public static function validate(array $in, int $channelId): array
    {
        $name = trim((string)($in['name'] ?? ''));
        if ($name === '') throw new ValidationError('シナリオ名を入力してください');
        if (mb_strlen($name) > 120) throw new ValidationError('シナリオ名は 120 文字以内にしてください');
        $desc = trim((string)($in['description'] ?? ''));
        if (mb_strlen($desc) > 500) throw new ValidationError('メモは 500 文字以内にしてください');

        $trigger = $in['triggerType'] ?? '';
        if (!in_array($trigger, ['follow', 'tag_added'], true)) throw new ValidationError('トリガーが不正です');
        $tagId = null;
        if ($trigger === 'tag_added') {
            $tagId = (int)($in['triggerTagId'] ?? 0);
            if (!$tagId) throw new ValidationError('トリガーにするタグを選択してください');
            if (!Db::val('SELECT 1 FROM tags WHERE id = ? AND channel_id = ?', [$tagId, $channelId])) {
                throw new ValidationError('トリガーのタグがこのアカウントにありません');
            }
        }

        $steps = $in['steps'] ?? null;
        if (!is_array($steps) || count($steps) < 1) throw new ValidationError('ステップを 1 つ以上追加してください');
        if (count($steps) > self::MAX_STEPS) throw new ValidationError('ステップは最大 ' . self::MAX_STEPS . ' までです');
        $outSteps = [];
        foreach (array_values($steps) as $s) {
            $delay = $s['delayMinutes'] ?? null;
            if (!is_numeric($delay) || (int)$delay != $delay || $delay < 0 || $delay > 60 * 24 * 365) {
                throw new ValidationError('待ち時間が不正です（0 分〜365 日）');
            }
            $time = $s['sendTime'] ?? null;
            if ($time !== null && $time !== '' && !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', (string)$time)) {
                throw new ValidationError('送信時刻は HH:mm 形式で指定してください');
            }
            $blocks = Blocks::validate($s['blocks'] ?? null);
            $outSteps[] = ['delay' => (int)$delay, 'time' => ($time === '' ? null : $time), 'blocks' => $blocks, 'messages' => Blocks::build($blocks, public_base_url())];
        }
        return ['name' => $name, 'description' => $desc === '' ? null : $desc, 'trigger' => $trigger, 'tagId' => $tagId, 'active' => !empty($in['isActive']) ? 1 : 0, 'steps' => $outSteps];
    }

    /** 新規作成または更新。更新では順番ごとに上書きし、進行中の友だちの送信待ちを消さない */
    public static function save(?int $scenarioId, int $channelId, array $v): int
    {
        return (int)Db::tx(function () use ($scenarioId, $channelId, $v) {
            if ($scenarioId === null) {
                $scenarioId = Db::insert(
                    'INSERT INTO scenarios (channel_id, name, description, trigger_type, trigger_tag_id, is_active, created_at) VALUES (?,?,?,?,?,?,?)',
                    [$channelId, $v['name'], $v['description'], $v['trigger'], $v['tagId'], $v['active'], now_utc()]
                );
            } else {
                Db::exec(
                    'UPDATE scenarios SET name = ?, description = ?, trigger_type = ?, trigger_tag_id = ?, is_active = ? WHERE id = ? AND channel_id = ?',
                    [$v['name'], $v['description'], $v['trigger'], $v['tagId'], $v['active'], $scenarioId, $channelId]
                );
            }
            foreach ($v['steps'] as $i => $s) {
                Db::exec(
                    'INSERT INTO scenario_steps (scenario_id, step_order, delay_minutes, send_time, messages, blocks) VALUES (?,?,?,?,?,?)
                     ON DUPLICATE KEY UPDATE delay_minutes = VALUES(delay_minutes), send_time = VALUES(send_time), messages = VALUES(messages), blocks = VALUES(blocks)',
                    [$scenarioId, $i, $s['delay'], $s['time'], json_encode($s['messages'], JSON_UNESCAPED_UNICODE), json_encode($s['blocks'], JSON_UNESCAPED_UNICODE)]
                );
            }
            Db::exec('DELETE FROM scenario_steps WHERE scenario_id = ? AND step_order >= ?', [$scenarioId, count($v['steps'])]);
            return $scenarioId;
        });
    }

    /**
     * 他アカウントへコピー。コピー先では誤配信防止のため「無効」で作成。
     * タグトリガーはタグ名で対応づけ、コピー先に無ければ同名タグを作る。
     */
    public static function copy(int $scenarioId, int $fromChannelId, array $targetChannelIds): int
    {
        $src = Db::one('SELECT * FROM scenarios WHERE id = ? AND channel_id = ?', [$scenarioId, $fromChannelId]);
        if (!$src) throw new ValidationError('シナリオが見つかりません', 404);
        $steps = Db::all('SELECT * FROM scenario_steps WHERE scenario_id = ? ORDER BY step_order', [$scenarioId]);
        $srcTag = $src['trigger_tag_id'] ? Db::one('SELECT * FROM tags WHERE id = ?', [$src['trigger_tag_id']]) : null;

        $n = 0;
        foreach ($targetChannelIds as $target) {
            Db::tx(function () use ($src, $steps, $srcTag, $target) {
                $tagId = null;
                if ($src['trigger_type'] === 'tag_added' && $srcTag) {
                    Db::exec('INSERT IGNORE INTO tags (channel_id, name, color, created_at) VALUES (?,?,?,?)', [$target, $srcTag['name'], $srcTag['color'], now_utc()]);
                    $tagId = (int)Db::val('SELECT id FROM tags WHERE channel_id = ? AND name = ?', [$target, $srcTag['name']]);
                }
                $newId = Db::insert(
                    'INSERT INTO scenarios (channel_id, name, description, trigger_type, trigger_tag_id, is_active, created_at) VALUES (?,?,?,?,?,0,?)',
                    [$target, $src['name'], $src['description'], $src['trigger_type'], $tagId, now_utc()]
                );
                foreach ($steps as $s) {
                    Db::exec(
                        'INSERT INTO scenario_steps (scenario_id, step_order, delay_minutes, send_time, messages, blocks) VALUES (?,?,?,?,?,?)',
                        [$newId, $s['step_order'], $s['delay_minutes'], $s['send_time'], $s['messages'], $s['blocks']]
                    );
                }
            });
            $n++;
        }
        return $n;
    }

    // ---- 表示用 ----

    public static function formatMinutes(int $min): string
    {
        if ($min <= 0) return 'すぐ';
        if ($min % 1440 === 0) return intdiv($min, 1440) . '日';
        if ($min >= 1440) {
            $h = intdiv($min % 1440, 60);
            $r = $min % 60;
            return intdiv($min, 1440) . '日' . ($h ? $h . '時間' : '') . ($r ? $r . '分' : '');
        }
        if ($min % 60 === 0) return intdiv($min, 60) . '時間';
        return $min . '分';
    }

    /** 各ステップの「トリガーからの累計」の目安 */
    public static function cumulativeLabels(array $steps): array
    {
        $total = 0;
        $out = [];
        foreach ($steps as $s) {
            $total += (int)$s['delay_minutes'];
            if (!empty($s['send_time'])) {
                $days = intdiv($total, 1440);
                $out[] = $days === 0 ? '当日 ' . $s['send_time'] : $days . '日後 ' . $s['send_time'];
            } else {
                $out[] = $total <= 0 ? 'すぐ' : '約' . self::formatMinutes($total) . '後';
            }
        }
        return $out;
    }
}
