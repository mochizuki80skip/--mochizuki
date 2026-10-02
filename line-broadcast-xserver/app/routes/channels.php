<?php
declare(strict_types=1);

// ---- LINE アカウント管理（管理者のみ） ----

Router::get('/channels', function () {
    Auth::requireAdmin();
    $channels = Db::all(
        'SELECT c.*, (SELECT COUNT(*) FROM friends f WHERE f.channel_id = c.id AND f.is_following = 1) AS followers,
                (SELECT COUNT(*) FROM memberships m WHERE m.channel_id = c.id) AS members
           FROM line_channels c ORDER BY c.id'
    );
    View::render('channels/list', ['title' => 'LINE アカウント管理', 'channels' => $channels]);
});

Router::get('/channels/new', function () {
    Auth::requireAdmin();
    View::render('channels/new', ['title' => 'LINE アカウント追加']);
});

Router::post('/api/channels', function () {
    Auth::requireAdmin();
    $in = json_body() ?? [];
    $name = trim((string)($in['name'] ?? ''));
    $token = trim((string)($in['accessToken'] ?? ''));
    $secret = trim((string)($in['channelSecret'] ?? ''));
    $color = (string)($in['color'] ?? '#06C755');
    if ($name === '' || mb_strlen($name) > 120) json_error('表示名を 1〜120 文字で入力してください');
    if (strlen($token) < 10 || strlen($secret) < 10) json_error('アクセストークンとチャネルシークレットを入力してください');
    if (!preg_match('/^#[0-9a-fA-F]{6}$/', $color)) $color = '#06C755';

    try {
        Line::botInfo($token); // LINE へ実際に接続できるか検証
    } catch (LineException $e) {
        json_error('LINE への接続に失敗しました: ' . $e->getMessage());
    }
    $id = Db::insert(
        'INSERT INTO line_channels (name, description, color, access_token, channel_secret, is_active, created_at) VALUES (?,?,?,?,?,1,?)',
        [$name, trim((string)($in['description'] ?? '')) ?: null, $color, Crypto::encrypt($token), Crypto::encrypt($secret), now_utc()]
    );
    json_out(['ok' => true, 'id' => $id]);
});

// ---- アカウント設定 ----

Router::get('/c/{id}/settings', function (array $p) {
    $ch = Auth::requireChannel((int)$p['id']);
    $members = Auth::isAdmin()
        ? Db::all('SELECT u.id, u.email, u.name FROM memberships m JOIN admin_users u ON u.id = m.admin_user_id WHERE m.channel_id = ? ORDER BY m.id', [$ch['id']])
        : [];
    View::render('settings/index', [
        'title' => '設定', 'channel' => $ch, 'active' => 'settings', 'members' => $members,
        'webhookUrl' => public_base_url() . '/webhook/' . $ch['id'], 'isAdmin' => Auth::isAdmin(),
    ], 'channel_layout');
});

Router::post('/api/c/{id}/settings', function (array $p) {
    Auth::requireAdmin();
    $ch = Auth::requireChannel((int)$p['id']);
    $in = json_body() ?? [];
    $name = trim((string)($in['name'] ?? $ch['name']));
    if ($name === '' || mb_strlen($name) > 120) json_error('表示名を 1〜120 文字で入力してください');
    $color = (string)($in['color'] ?? $ch['color']);
    if (!preg_match('/^#[0-9a-fA-F]{6}$/', $color)) json_error('カラーが不正です');

    $token = trim((string)($in['accessToken'] ?? ''));
    $secret = trim((string)($in['channelSecret'] ?? ''));
    $newToken = $token !== '' ? $token : Line::token($ch);
    if ($token !== '' || $secret !== '') {
        if (($token !== '' && strlen($token) < 10) || ($secret !== '' && strlen($secret) < 10)) json_error('認証情報が短すぎます');
        try {
            Line::botInfo($newToken);
        } catch (LineException $e) {
            json_error('LINE への接続に失敗しました: ' . $e->getMessage());
        }
    }
    Db::exec(
        'UPDATE line_channels SET name = ?, description = ?, color = ?, is_active = ?,
                access_token = ?, channel_secret = ? WHERE id = ?',
        [$name, trim((string)($in['description'] ?? '')) ?: null, $color, !empty($in['isActive']) ? 1 : 0,
            $token !== '' ? Crypto::encrypt($token) : $ch['access_token'],
            $secret !== '' ? Crypto::encrypt($secret) : $ch['channel_secret'], $ch['id']]
    );
    json_out(['ok' => true]);
});

Router::post('/c/{id}/delete', function (array $p) {
    Auth::requireAdmin();
    $ch = Auth::requireChannel((int)$p['id']);
    if (trim((string)($_POST['confirm_name'] ?? '')) !== $ch['name']) {
        flash('確認のためアカウント名を正確に入力してください', 'error');
        redirect('/c/' . $ch['id'] . '/settings');
    }
    Db::exec('DELETE FROM line_channels WHERE id = ?', [$ch['id']]);
    flash('アカウントを削除しました');
    redirect('/channels');
});

// ---- メンバー（店舗スタッフの権限） ----

Router::post('/c/{id}/members', function (array $p) {
    Auth::requireAdmin();
    $ch = Auth::requireChannel((int)$p['id']);
    $email = trim((string)($_POST['login_id'] ?? '')); // DB の列名は email だが、中身はログインID
    if (!valid_login_id($email)) {
        flash('ログインIDは半角英数字（. _ @ - も可）で 3〜50 文字にしてください', 'error');
        redirect('/c/' . $ch['id'] . '/settings');
    }
    $user = Db::one('SELECT id FROM admin_users WHERE email = ?', [$email]);
    if (!$user) {
        $pw = (string)($_POST['password'] ?? '');
        if (mb_strlen($pw) < 8) {
            flash('新しいユーザーにはパスワード（8文字以上）が必要です', 'error');
            redirect('/c/' . $ch['id'] . '/settings');
        }
        $uid = Db::insert(
            "INSERT INTO admin_users (email, password_hash, name, role, created_at) VALUES (?,?,?,'operator',?)",
            [$email, password_hash($pw, PASSWORD_DEFAULT), trim((string)($_POST['name'] ?? '')) ?: null, now_utc()]
        );
    } else {
        $uid = (int)$user['id'];
    }
    Db::exec('INSERT IGNORE INTO memberships (admin_user_id, channel_id, created_at) VALUES (?,?,?)', [$uid, $ch['id'], now_utc()]);
    flash('メンバーを追加しました');
    redirect('/c/' . $ch['id'] . '/settings');
});

Router::post('/c/{id}/members/{uid}/remove', function (array $p) {
    Auth::requireAdmin();
    $ch = Auth::requireChannel((int)$p['id']);
    Db::exec('DELETE FROM memberships WHERE channel_id = ? AND admin_user_id = ?', [$ch['id'], (int)$p['uid']]);
    flash('メンバーを外しました');
    redirect('/c/' . $ch['id'] . '/settings');
});
