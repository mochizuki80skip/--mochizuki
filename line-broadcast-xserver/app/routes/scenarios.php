<?php
declare(strict_types=1);

function scenario_tags(array $ch): array
{
    return array_map(
        fn($t) => ['id' => (int)$t['id'], 'name' => $t['name']],
        Db::all('SELECT id, name FROM tags WHERE channel_id = ? ORDER BY name', [$ch['id']])
    );
}

Router::get('/c/{id}/scenarios', function (array $p) {
    $ch = Auth::requireChannel((int)$p['id']);
    $cid = (int)$ch['id'];
    $scenarios = Db::all('SELECT s.*, t.name AS tag_name FROM scenarios s LEFT JOIN tags t ON t.id = s.trigger_tag_id WHERE s.channel_id = ? ORDER BY s.id DESC', [$cid]);
    foreach ($scenarios as &$s) {
        $s['steps'] = Db::all('SELECT delay_minutes, send_time, messages FROM scenario_steps WHERE scenario_id = ? ORDER BY step_order', [$s['id']]);
        $s['labels'] = Scenarios::cumulativeLabels($s['steps']);
        $s['running'] = (int)Db::val("SELECT COUNT(*) FROM scenario_runs WHERE scenario_id = ? AND status = 'running'", [$s['id']]);
        $s['done'] = (int)Db::val("SELECT COUNT(*) FROM scenario_runs WHERE scenario_id = ? AND status = 'completed'", [$s['id']]);
    }
    unset($s);
    // 送信予定を 10 分以上過ぎても未送信 = cron が動いていない可能性
    $overdue = (int)Db::val(
        "SELECT COUNT(*) FROM scenario_run_steps rs JOIN scenario_runs r ON r.id = rs.run_id JOIN scenarios s ON s.id = r.scenario_id
          WHERE s.channel_id = ? AND rs.status = 'pending' AND rs.scheduled_at < ?",
        [$cid, gmdate('Y-m-d H:i:s', time() - 600)]
    );
    $others = array_values(array_filter(Auth::channels(), fn($c) => (int)$c['id'] !== $cid));
    View::render('scenarios/index', [
        'title' => 'ステップ配信', 'channel' => $ch, 'active' => 'scenarios', 'scenarios' => $scenarios, 'overdue' => $overdue,
        'others' => array_map(fn($c) => ['id' => (int)$c['id'], 'name' => $c['name']], $others),
    ], 'channel_layout');
});

Router::get('/c/{id}/scenarios/new', function (array $p) {
    $ch = Auth::requireChannel((int)$p['id']);
    View::render('scenarios/form', [
        'title' => 'ステップ配信 / 新規作成', 'channel' => $ch, 'active' => 'scenarios', 'stats' => null,
        'cfg' => ['channelId' => (int)$ch['id'], 'scenarioId' => null, 'tags' => scenario_tags($ch), 'initial' => null],
    ], 'channel_layout');
});

Router::get('/c/{id}/scenarios/{sid}', function (array $p) {
    $ch = Auth::requireChannel((int)$p['id']);
    $s = Db::one('SELECT * FROM scenarios WHERE id = ? AND channel_id = ?', [(int)$p['sid'], $ch['id']]);
    if (!$s) {
        http_response_code(404);
        View::render('error', ['title' => '見つかりません', 'message' => 'ステップ配信が見つかりません。'], 'layout');
        return;
    }
    $steps = Db::all('SELECT * FROM scenario_steps WHERE scenario_id = ? ORDER BY step_order', [$s['id']]);
    $counts = [];
    foreach (Db::all('SELECT step_id, status, COUNT(*) n FROM scenario_run_steps WHERE step_id IN (' . Db::in(array_column($steps, 'id')) . ') GROUP BY step_id, status', array_column($steps, 'id')) as $r) {
        $counts[(int)$r['step_id']][$r['status']] = (int)$r['n'];
    }
    $labels = Scenarios::cumulativeLabels($steps);
    $stats = [
        'started' => (int)Db::val('SELECT COUNT(*) FROM scenario_runs WHERE scenario_id = ?', [$s['id']]),
        'running' => (int)Db::val("SELECT COUNT(*) FROM scenario_runs WHERE scenario_id = ? AND status = 'running'", [$s['id']]),
        'done' => (int)Db::val("SELECT COUNT(*) FROM scenario_runs WHERE scenario_id = ? AND status = 'completed'", [$s['id']]),
        'rows' => array_map(fn($st, $i) => ['no' => $i + 1, 'when' => $labels[$i], 'sent' => $counts[(int)$st['id']]['sent'] ?? 0,
            'pending' => ($counts[(int)$st['id']]['pending'] ?? 0) + ($counts[(int)$st['id']]['sending'] ?? 0),
            'bad' => ($counts[(int)$st['id']]['failed'] ?? 0) + ($counts[(int)$st['id']]['skipped'] ?? 0)], $steps, array_keys($steps)),
    ];
    View::render('scenarios/form', [
        'title' => 'ステップ配信 / 編集', 'channel' => $ch, 'active' => 'scenarios', 'stats' => $stats,
        'cfg' => [
            'channelId' => (int)$ch['id'], 'scenarioId' => (int)$s['id'], 'tags' => scenario_tags($ch),
            'initial' => [
                'name' => $s['name'], 'description' => $s['description'], 'triggerType' => $s['trigger_type'],
                'triggerTagId' => $s['trigger_tag_id'] ? (int)$s['trigger_tag_id'] : null, 'isActive' => (bool)$s['is_active'],
                'steps' => array_map(fn($st) => [
                    'delayMinutes' => (int)$st['delay_minutes'], 'sendTime' => $st['send_time'], 'blocks' => json_decode($st['blocks'], true),
                ], $steps),
            ],
        ],
    ], 'channel_layout');
});

// ---- JSON API ----

$saveScenario = function (array $p, bool $isNew) {
    $ch = Auth::requireChannel((int)$p['id']);
    $sid = null;
    if (!$isNew) {
        $sid = (int)$p['sid'];
        if (!Db::val('SELECT 1 FROM scenarios WHERE id = ? AND channel_id = ?', [$sid, $ch['id']])) json_error('not_found', 404);
    }
    try {
        $v = Scenarios::validate(json_body() ?? [], (int)$ch['id']);
    } catch (ValidationError $e) {
        json_error($e->getMessage(), $e->status);
    }
    json_out(['ok' => true, 'id' => Scenarios::save($sid, (int)$ch['id'], $v)]);
};
Router::post('/api/c/{id}/scenarios', fn(array $p) => $saveScenario($p, true));
Router::post('/api/c/{id}/scenarios/{sid}', fn(array $p) => $saveScenario($p, false));

function scenario_guard(array $p): array
{
    $ch = Auth::requireChannel((int)$p['id']);
    if (!Db::val('SELECT 1 FROM scenarios WHERE id = ? AND channel_id = ?', [(int)$p['sid'], $ch['id']])) json_error('not_found', 404);
    return $ch;
}

Router::post('/api/c/{id}/scenarios/{sid}/toggle', function (array $p) {
    $ch = scenario_guard($p);
    $on = !empty((json_body() ?? [])['isActive']) ? 1 : 0;
    Db::exec('UPDATE scenarios SET is_active = ? WHERE id = ? AND channel_id = ?', [$on, (int)$p['sid'], $ch['id']]);
    json_out(['ok' => true]);
});

Router::post('/api/c/{id}/scenarios/{sid}/delete', function (array $p) {
    $ch = scenario_guard($p);
    Db::exec('DELETE FROM scenarios WHERE id = ? AND channel_id = ?', [(int)$p['sid'], $ch['id']]);
    json_out(['ok' => true]);
});

Router::post('/api/c/{id}/scenarios/{sid}/copy', function (array $p) {
    $ch = scenario_guard($p);
    $targets = array_values(array_unique(array_map('intval', (json_body() ?? [])['channelIds'] ?? [])));
    $targets = array_values(array_filter($targets, fn($t) => $t !== (int)$ch['id']));
    if (!$targets) json_error('コピー先を選択してください');
    if (array_diff($targets, Auth::channelIds())) json_error('コピー先が不正、または権限がありません', 403);
    json_out(['ok' => true, 'copied' => Scenarios::copy((int)$p['sid'], (int)$ch['id'], $targets)]);
});
