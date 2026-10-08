<?php
declare(strict_types=1);

Router::get('/campaigns', function () {
    Auth::requireLogin();
    $ids = Auth::channelIds();
    $where = Auth::isAdmin() ? '' : 'WHERE b.channel_id IN (' . Db::in($ids) . ')';
    $rows = Db::all(
        "SELECT c.id, c.title, c.audience_tag_names, c.scheduled_at, c.created_at, COUNT(b.id) AS n, GROUP_CONCAT(b.status) AS statuses
           FROM campaigns c JOIN broadcasts b ON b.campaign_id = c.id $where
          GROUP BY c.id ORDER BY c.created_at DESC, c.id DESC LIMIT 100",
        Auth::isAdmin() ? [] : $ids
    );
    View::render('campaigns/index', ['title' => '一括配信', 'rows' => $rows]);
});

Router::get('/campaigns/new', function () {
    Auth::requireLogin();
    $channels = Auth::channels();
    $ids = array_map(fn($c) => (int)$c['id'], $channels);
    $followers = [];
    $tagMap = [];
    if ($ids) {
        foreach (Db::all('SELECT channel_id, COUNT(*) n FROM friends WHERE is_following = 1 AND channel_id IN (' . Db::in($ids) . ') GROUP BY channel_id', $ids) as $r) {
            $followers[(int)$r['channel_id']] = (int)$r['n'];
        }
        // タグは「名前」単位でまとめ、どのアカウントに存在するかを持たせる
        foreach (Db::all('SELECT name, channel_id FROM tags WHERE channel_id IN (' . Db::in($ids) . ') ORDER BY name', $ids) as $r) {
            $tagMap[$r['name']][] = (int)$r['channel_id'];
        }
    }
    $pre = (int)($_GET['channel'] ?? 0);
    View::render('campaigns/new', [
        'title' => '一括配信を作成',
        'cfg' => [
            'channels' => array_map(fn($c) => ['id' => (int)$c['id'], 'name' => $c['name'], 'color' => $c['color'], 'followers' => $followers[(int)$c['id']] ?? 0], $channels),
            'tags' => array_map(fn($n, $cs) => ['name' => (string)$n, 'channelIds' => $cs], array_keys($tagMap), array_values($tagMap)),
            'selected' => in_array($pre, $ids, true) ? [$pre] : [],
        ],
    ]);
});

Router::get('/campaigns/{id}', function (array $p) {
    Auth::requireLogin();
    $c = Db::one('SELECT * FROM campaigns WHERE id = ?', [(int)$p['id']]);
    $ids = Auth::channelIds();
    $broadcasts = [];
    if ($c) {
        $sql = 'SELECT b.*, ch.name AS channel_name, ch.color AS channel_color FROM broadcasts b JOIN line_channels ch ON ch.id = b.channel_id WHERE b.campaign_id = ?';
        $params = [$c['id']];
        if (!Auth::isAdmin()) {
            $sql .= ' AND b.channel_id IN (' . Db::in($ids) . ')';
            $params = array_merge($params, $ids);
        }
        $broadcasts = Db::all($sql . ' ORDER BY b.id', $params);
    }
    if (!$c || (!$broadcasts && !Auth::isAdmin())) {
        http_response_code(404);
        View::render('error', ['title' => '見つかりません', 'message' => '配信が見つかりません。'], 'layout');
        return;
    }
    $statuses = array_column($broadcasts, 'status');
    $insightRows = [];
    foreach (Db::all('SELECT * FROM broadcast_insights WHERE broadcast_id IN (' . Db::in(array_column($broadcasts, 'id') ?: [0]) . ')', array_column($broadcasts, 'id') ?: [0]) as $r) {
        $insightRows[(int)$r['broadcast_id']] = Analytics::insightView($r);
    }
    $links = Analytics::linkStats((int)$c['id']);
    View::render('campaigns/show', [
        'links' => $links, 'clicksByDay' => Analytics::clicksByDay((int)$c['id']), 'insights' => $insightRows,
        'sentTotal' => array_sum(array_map(fn($b) => (int)$b['success_count'], $broadcasts)),
        'title' => $c['title'], 'c' => $c, 'broadcasts' => $broadcasts,
        'status' => Campaigns::summarize($statuses),
        'pending' => count(array_filter($statuses, fn($s) => in_array($s, ['draft', 'scheduled'], true))),
        'blocks' => json_decode($c['blocks'], true),
        'tagNames' => json_decode($c['audience_tag_names'], true) ?: [],
    ]);
});

Router::post('/api/campaigns', function () {
    $u = Auth::requireLogin();
    try {
        $id = Campaigns::create($u, json_body() ?? []);
    } catch (ValidationError $e) {
        json_error($e->getMessage(), $e->status);
    }
    json_out(['ok' => true, 'campaignId' => $id]);
});

Router::post('/api/campaigns/{id}/execute', function (array $p) {
    Auth::requireLogin();
    $results = Campaigns::executeAll((int)$p['id'], Auth::channelIds());
    json_out(['ok' => true, 'results' => $results]);
});

Router::post('/api/campaigns/{id}/cancel', function (array $p) {
    Auth::requireLogin();
    json_out(['ok' => true, 'cancelled' => Campaigns::cancel((int)$p['id'], Auth::channelIds())]);
});

// LINE の配信統計（開封・クリック）を取得し直す
Router::post('/api/campaigns/{id}/insights', function (array $p) {
    Auth::requireLogin();
    $ids = Auth::channelIds();
    $sql = 'SELECT b.id FROM broadcasts b JOIN broadcast_insights bi ON bi.broadcast_id = b.id WHERE b.campaign_id = ?';
    $params = [(int)$p['id']];
    if (!Auth::isAdmin()) {
        $sql .= ' AND b.channel_id IN (' . Db::in($ids ?: [0]) . ')';
        $params = array_merge($params, $ids ?: [0]);
    }
    $rows = Db::all($sql, $params);
    if (!$rows) json_error('LINE の統計を取得できる配信がありません（全員配信のみ対象です）', 404);
    $errors = [];
    foreach ($rows as $r) {
        $res = Analytics::refreshInsight((int)$r['id']);
        if (!$res['ok']) $errors[] = $res['error'];
    }
    json_out(['ok' => !$errors, 'errors' => array_values(array_unique($errors)), 'error' => $errors ? implode(' / ', array_unique($errors)) : null]);
});

// リンクごとのクリック数を CSV でダウンロード
Router::get('/campaigns/{id}/links.csv', function (array $p) {
    Auth::requireLogin();
    $c = Db::one('SELECT id, title FROM campaigns WHERE id = ?', [(int)$p['id']]);
    $ids = Auth::channelIds();
    $allowed = $c && (Auth::isAdmin() || Db::val('SELECT 1 FROM broadcasts WHERE campaign_id = ? AND channel_id IN (' . Db::in($ids ?: [0]) . ') LIMIT 1', array_merge([$c['id']], $ids ?: [0])));
    if (!$allowed) {
        http_response_code(404);
        View::render('error', ['title' => '見つかりません', 'message' => '配信が見つかりません。'], 'layout');
        return;
    }
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="clicks-' . (int)$c['id'] . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF");
    fputcsv($out, ['リンク', 'URL', 'クリック数', 'クリックした人数(概数)']);
    foreach (Analytics::linkStats((int)$c['id']) as $l) fputcsv($out, [$l['label'], $l['url'], $l['clicks'], $l['people']]);
    fclose($out);
    exit;
});
