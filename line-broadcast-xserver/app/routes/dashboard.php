<?php
declare(strict_types=1);

Router::get('/dashboard', function () {
    $u = Auth::requireLogin();
    $channels = Auth::channels();
    if (count($channels) === 1 && $u['role'] !== 'super_admin') redirect('/c/' . $channels[0]['id']);

    $counts = [];
    if ($channels) {
        $ids = array_map(fn($c) => (int)$c['id'], $channels);
        foreach (Db::all('SELECT channel_id, COUNT(*) n FROM friends WHERE is_following = 1 AND channel_id IN (' . Db::in($ids) . ') GROUP BY channel_id', $ids) as $r) {
            $counts[(int)$r['channel_id']] = (int)$r['n'];
        }
    }
    $quotas = Quota::forChannels($channels ? array_map(fn($c) => (int)$c['id'], $channels) : []);
    $last = Cron::lastRun();
    $cronStale = $u['role'] === 'super_admin' && ($last === null || time() - $last > 600);
    View::render('dashboard/hub', ['title' => 'アカウント一覧', 'channels' => $channels, 'counts' => $counts, 'cronStale' => $cronStale, 'cronLast' => $last, 'quotas' => $quotas]);
});

Router::get('/c/{id}', function (array $p) {
    $ch = Auth::requireChannel((int)$p['id']);
    $id = (int)$ch['id'];
    $stats = [
        '現在の友だち（ブロック除く）' => (int)Db::val('SELECT COUNT(*) FROM friends WHERE channel_id = ? AND is_following = 1', [$id]),
        '累計友だち数' => (int)Db::val('SELECT COUNT(*) FROM friends WHERE channel_id = ?', [$id]),
        'タグ数' => (int)Db::val('SELECT COUNT(*) FROM tags WHERE channel_id = ?', [$id]),
        '予約中の配信' => (int)Db::val("SELECT COUNT(*) FROM broadcasts WHERE channel_id = ? AND status = 'scheduled'", [$id]),
        'ステップ配信 進行中' => (int)Db::val("SELECT COUNT(*) FROM scenario_runs r JOIN scenarios s ON s.id = r.scenario_id WHERE s.channel_id = ? AND r.status = 'running'", [$id]),
    ];
    $inbound = Db::all(
        'SELECT m.*, f.display_name, f.id AS fid FROM inbound_messages m JOIN friends f ON f.id = m.friend_id
          WHERE f.channel_id = ? ORDER BY m.received_at DESC LIMIT 10',
        [$id]
    );
    $quota = Quota::forChannels([$id])[$id] ?? null;
    View::render('dashboard/channel', ['title' => 'ダッシュボード', 'channel' => $ch, 'active' => 'dash', 'stats' => $stats, 'inbound' => $inbound, 'quota' => $quota], 'channel_layout');
});

// 配信数（月の上限と今月の消費）を LINE から取り直す。body: {channelIds:[...]}
Router::post('/api/quota/refresh', function () {
    Auth::requireLogin();
    $in = json_body() ?? [];
    $want = array_values(array_unique(array_map('intval', is_array($in['channelIds'] ?? null) ? $in['channelIds'] : [])));
    $allowed = array_values(array_intersect($want, Auth::channelIds()));
    if (!$allowed) json_error('対象のアカウントがありません', 400);
    foreach (array_slice($allowed, 0, 20) as $id) {
        $ch = Db::one('SELECT * FROM line_channels WHERE id = ? AND is_active = 1', [$id]);
        if ($ch) Quota::refresh($ch);
    }
    json_out(['ok' => true, 'quotas' => (object)Quota::forChannels($allowed)]);
});
