<?php
declare(strict_types=1);

// ---- キーワード自動タグ付け（エリア別の登録URL・社員向けの合言葉など） ----

Router::get('/c/{id}/keywords', function (array $p) {
    $ch = Auth::requireChannel((int)$p['id']);
    $cid = (int)$ch['id'];

    // 友だち追加用の URL に使う、公式アカウントの LINE ID（@xxxxxxx）
    $basicId = null;
    $basicError = null;
    try {
        $basicId = Line::botInfo(Line::token($ch))['basicId'] ?? null;
        if (!$basicId) $basicError = 'LINE ID を取得できませんでした';
    } catch (Throwable $e) {
        $basicError = 'LINE に接続できません: ' . $e->getMessage();
    }

    $rules = Db::all(
        'SELECT k.*, t.name AS tag_name, t.color AS tag_color FROM keyword_rules k JOIN tags t ON t.id = k.tag_id WHERE k.channel_id = ? ORDER BY k.id',
        [$cid]
    );
    $rules = array_map(fn($r) => [
        'id' => (int)$r['id'], 'keyword' => $r['keyword'], 'matchType' => $r['match_type'], 'tagName' => $r['tag_name'],
        'tagColor' => $r['tag_color'], 'replyText' => (string)$r['reply_text'], 'isActive' => (bool)$r['is_active'],
        'url' => $basicId ? Keywords::entryUrl($basicId, $r['keyword']) : null,
    ], $rules);

    View::render('keywords/index', [
        'title' => '自動タグ付け', 'channel' => $ch, 'active' => 'keywords', 'basicId' => $basicId, 'basicError' => $basicError,
        'cfg' => [
            'channelId' => $cid, 'rules' => $rules, 'basicId' => $basicId,
            'tags' => array_map(fn($t) => ['id' => (int)$t['id'], 'name' => $t['name']], Db::all('SELECT id, name FROM tags WHERE channel_id = ? ORDER BY name', [$cid])),
        ],
    ], 'channel_layout');
});

Router::post('/api/c/{id}/keywords', function (array $p) {
    $ch = Auth::requireChannel((int)$p['id']);
    $cid = (int)$ch['id'];
    $in = json_body() ?? [];

    $keyword = trim((string)($in['keyword'] ?? ''));
    $type = ($in['matchType'] ?? 'exact') === 'contains' ? 'contains' : 'exact';
    $reply = trim((string)($in['replyText'] ?? ''));
    if ($keyword === '' || mb_strlen($keyword) > 100) json_error('キーワードを 1〜100 文字で入力してください');
    if ($type === 'contains' && mb_strlen(Keywords::normalize($keyword)) < 2) json_error('「含む」で判定するキーワードは 2 文字以上にしてください（短すぎると他のメッセージにも反応します）');
    if (mb_strlen($reply) > 500) json_error('返信メッセージは 500 文字以内にしてください');

    // タグ: 既存を選ぶ、または名前を入れて新規作成
    $tagId = (int)($in['tagId'] ?? 0);
    $newName = trim((string)($in['newTagName'] ?? ''));
    if ($newName !== '') {
        if (mb_strlen($newName) > 100) json_error('タグ名は 100 文字以内にしてください');
        Db::exec('INSERT IGNORE INTO tags (channel_id, name, color, created_at) VALUES (?,?,?,?)', [$cid, $newName, '#06C755', now_utc()]);
        $tagId = (int)Db::val('SELECT id FROM tags WHERE channel_id = ? AND name = ?', [$cid, $newName]);
    }
    if (!$tagId || !Db::val('SELECT 1 FROM tags WHERE id = ? AND channel_id = ?', [$tagId, $cid])) json_error('付けるタグを選択、または新しいタグ名を入力してください');

    $norm = Keywords::normalize($keyword);
    foreach (Db::all('SELECT keyword, match_type FROM keyword_rules WHERE channel_id = ? AND tag_id = ?', [$cid, $tagId]) as $r) {
        if (Keywords::normalize($r['keyword']) === $norm && $r['match_type'] === $type) json_error('同じキーワード・同じタグのルールがすでにあります');
    }

    $id = Db::insert(
        'INSERT INTO keyword_rules (channel_id, keyword, match_type, tag_id, reply_text, is_active, created_at) VALUES (?,?,?,?,?,1,?)',
        [$cid, $keyword, $type, $tagId, $reply === '' ? null : $reply, now_utc()]
    );
    json_out(['ok' => true, 'id' => $id]);
});

function keyword_guard(array $p): array
{
    $ch = Auth::requireChannel((int)$p['id']);
    if (!Db::val('SELECT 1 FROM keyword_rules WHERE id = ? AND channel_id = ?', [(int)$p['rid'], $ch['id']])) json_error('ルールが見つかりません', 404);
    return $ch;
}

Router::post('/api/c/{id}/keywords/{rid}/toggle', function (array $p) {
    $ch = keyword_guard($p);
    $on = !empty((json_body() ?? [])['isActive']) ? 1 : 0;
    Db::exec('UPDATE keyword_rules SET is_active = ? WHERE id = ? AND channel_id = ?', [$on, (int)$p['rid'], $ch['id']]);
    json_out(['ok' => true]);
});

Router::post('/api/c/{id}/keywords/{rid}/delete', function (array $p) {
    $ch = keyword_guard($p);
    Db::exec('DELETE FROM keyword_rules WHERE id = ? AND channel_id = ?', [(int)$p['rid'], $ch['id']]);
    json_out(['ok' => true]);
});
