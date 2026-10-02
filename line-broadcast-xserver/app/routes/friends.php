<?php
declare(strict_types=1);

Router::get('/c/{id}/friends', function (array $p) {
    $ch = Auth::requireChannel((int)$p['id']);
    $q = trim((string)($_GET['q'] ?? ''));
    $tagId = (int)($_GET['tag'] ?? 0);
    $page = max(1, (int)($_GET['page'] ?? 1));
    $per = 50;

    $where = 'f.channel_id = ?';
    $params = [$ch['id']];
    if ($q !== '') {
        $where .= ' AND f.display_name LIKE ?';
        $params[] = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $q) . '%';
    }
    if ($tagId) {
        $where .= ' AND EXISTS (SELECT 1 FROM friend_tags ft WHERE ft.friend_id = f.id AND ft.tag_id = ?)';
        $params[] = $tagId;
    }
    $total = (int)Db::val("SELECT COUNT(*) FROM friends f WHERE $where", $params);
    $friends = Db::all("SELECT f.* FROM friends f WHERE $where ORDER BY f.followed_at DESC LIMIT $per OFFSET " . (($page - 1) * $per), $params);

    $tagsByFriend = [];
    if ($friends) {
        $ids = array_map(fn($f) => (int)$f['id'], $friends);
        foreach (Db::all('SELECT ft.friend_id, t.name, t.color FROM friend_tags ft JOIN tags t ON t.id = ft.tag_id WHERE ft.friend_id IN (' . Db::in($ids) . ')', $ids) as $r) {
            $tagsByFriend[(int)$r['friend_id']][] = $r;
        }
    }
    View::render('friends/list', [
        'title' => '友だち', 'channel' => $ch, 'active' => 'friends', 'friends' => $friends, 'tagsByFriend' => $tagsByFriend,
        'tags' => Db::all('SELECT id, name FROM tags WHERE channel_id = ? ORDER BY name', [$ch['id']]),
        'q' => $q, 'tagId' => $tagId, 'page' => $page, 'pages' => max(1, (int)ceil($total / $per)), 'total' => $total,
    ], 'channel_layout');
});

function load_friend(array $ch, int $fid): array
{
    $f = Db::one('SELECT * FROM friends WHERE id = ? AND channel_id = ?', [$fid, $ch['id']]);
    if (!$f) {
        http_response_code(404);
        View::render('error', ['title' => '見つかりません', 'message' => '友だちが見つかりません。'], 'layout');
        exit;
    }
    return $f;
}

Router::get('/c/{id}/friends/{fid}', function (array $p) {
    $ch = Auth::requireChannel((int)$p['id']);
    $f = load_friend($ch, (int)$p['fid']);
    View::render('friends/show', [
        'title' => $f['display_name'] ?: '友だち', 'channel' => $ch, 'active' => 'friends', 'friend' => $f,
        'tags' => Db::all('SELECT t.* FROM friend_tags ft JOIN tags t ON t.id = ft.tag_id WHERE ft.friend_id = ? ORDER BY t.name', [$f['id']]),
        'allTags' => Db::all('SELECT * FROM tags WHERE channel_id = ? ORDER BY name', [$ch['id']]),
        'messages' => Db::all('SELECT * FROM inbound_messages WHERE friend_id = ? ORDER BY received_at DESC LIMIT 50', [$f['id']]),
    ], 'channel_layout');
});

Router::post('/c/{id}/friends/{fid}/notes', function (array $p) {
    $ch = Auth::requireChannel((int)$p['id']);
    $f = load_friend($ch, (int)$p['fid']);
    Db::exec('UPDATE friends SET notes = ? WHERE id = ?', [mb_substr((string)($_POST['notes'] ?? ''), 0, 5000) ?: null, $f['id']]);
    flash('メモを保存しました');
    redirect('/c/' . $ch['id'] . '/friends/' . $f['id']);
});

Router::post('/c/{id}/friends/{fid}/tags', function (array $p) {
    $ch = Auth::requireChannel((int)$p['id']);
    $f = load_friend($ch, (int)$p['fid']);
    $tagId = (int)($_POST['tag_id'] ?? 0);
    if (Db::val('SELECT 1 FROM tags WHERE id = ? AND channel_id = ?', [$tagId, $ch['id']])) {
        // 新しく付いたときだけ、タグ付与をきっかけにするステップ配信を開始する
        if (Db::exec('INSERT IGNORE INTO friend_tags (friend_id, tag_id, added_at) VALUES (?,?,?)', [$f['id'], $tagId, now_utc()]) > 0) {
            Scenarios::startForTag((int)$ch['id'], (int)$f['id'], $tagId);
        }
    }
    redirect('/c/' . $ch['id'] . '/friends/' . $f['id']);
});

Router::post('/c/{id}/friends/{fid}/tags/{tid}/remove', function (array $p) {
    $ch = Auth::requireChannel((int)$p['id']);
    $f = load_friend($ch, (int)$p['fid']);
    Db::exec('DELETE FROM friend_tags WHERE friend_id = ? AND tag_id = ?', [$f['id'], (int)$p['tid']]);
    redirect('/c/' . $ch['id'] . '/friends/' . $f['id']);
});

// ---- タグ ----

Router::get('/c/{id}/tags', function (array $p) {
    $ch = Auth::requireChannel((int)$p['id']);
    $tags = Db::all('SELECT t.*, (SELECT COUNT(*) FROM friend_tags ft WHERE ft.tag_id = t.id) AS cnt FROM tags t WHERE t.channel_id = ? ORDER BY t.name', [$ch['id']]);
    View::render('tags/index', ['title' => 'タグ', 'channel' => $ch, 'active' => 'tags', 'tags' => $tags], 'channel_layout');
});

Router::post('/c/{id}/tags', function (array $p) {
    $ch = Auth::requireChannel((int)$p['id']);
    $name = trim((string)($_POST['name'] ?? ''));
    $color = (string)($_POST['color'] ?? '#06C755');
    if (!preg_match('/^#[0-9a-fA-F]{6}$/', $color)) $color = '#06C755';
    if ($name === '' || mb_strlen($name) > 100) {
        flash('タグ名を 1〜100 文字で入力してください', 'error');
    } elseif (Db::exec('INSERT IGNORE INTO tags (channel_id, name, color, created_at) VALUES (?,?,?,?)', [$ch['id'], $name, $color, now_utc()]) === 0) {
        flash('同じ名前のタグがすでにあります', 'error');
    } else {
        flash('タグを作成しました');
    }
    redirect('/c/' . $ch['id'] . '/tags');
});

Router::post('/c/{id}/tags/{tid}/delete', function (array $p) {
    $ch = Auth::requireChannel((int)$p['id']);
    Db::exec('DELETE FROM tags WHERE id = ? AND channel_id = ?', [(int)$p['tid'], $ch['id']]);
    flash('タグを削除しました');
    redirect('/c/' . $ch['id'] . '/tags');
});

// ---- アカウント別 配信履歴 ----

Router::get('/c/{id}/broadcasts', function (array $p) {
    $ch = Auth::requireChannel((int)$p['id']);
    $rows = Db::all(
        'SELECT b.*, c.title AS campaign_title FROM broadcasts b JOIN campaigns c ON c.id = b.campaign_id
          WHERE b.channel_id = ? ORDER BY b.created_at DESC, b.id DESC LIMIT 100',
        [$ch['id']]
    );
    View::render('channels/broadcasts', ['title' => '配信履歴', 'channel' => $ch, 'active' => 'broadcasts', 'rows' => $rows], 'channel_layout');
});
