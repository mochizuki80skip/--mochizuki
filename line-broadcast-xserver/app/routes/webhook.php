<?php
declare(strict_types=1);

// LINE からの Webhook（友だち追加・ブロック・メッセージ受信）。アカウントごとに URL が異なる: /webhook/{アカウントID}
Router::post('/webhook/{id}', function (array $p) {
    $ch = Db::one('SELECT * FROM line_channels WHERE id = ?', [(int)$p['id']]);
    if (!$ch) json_error('channel not found', 404);
    if (!(int)$ch['is_active']) json_error('channel inactive', 403);

    $raw = (string)file_get_contents('php://input');
    $sig = $_SERVER['HTTP_X_LINE_SIGNATURE'] ?? null;
    if ($sig === null && function_exists('getallheaders')) {
        $sig = array_change_key_case(getallheaders(), CASE_LOWER)['x-line-signature'] ?? null;
    }
    if (!Line::verifySignature($raw, $sig, Line::secret($ch))) {
        json_error('invalid signature', 401);
    }
    $payload = json_decode($raw, true);
    if (!is_array($payload)) json_error('invalid json', 400);

    foreach ($payload['events'] ?? [] as $ev) {
        try {
            handle_line_event($ch, $ev);
        } catch (Throwable $e) {
            error_log('[linehub] webhook event failed: ' . $e);
        }
    }
    json_out(['ok' => true]);
}, false);

function handle_line_event(array $ch, array $ev): void
{
    $userId = ($ev['source']['type'] ?? '') === 'user' ? ($ev['source']['userId'] ?? null) : null;
    if (!$userId) return;
    $cid = (int)$ch['id'];

    switch ($ev['type'] ?? '') {
        case 'follow':
            $profile = Line::profile(Line::token($ch), $userId) ?? [];
            $now = now_utc();
            Db::exec(
                'INSERT INTO friends (channel_id, line_user_id, display_name, picture_url, status_message, language, is_following, followed_at)
                 VALUES (?,?,?,?,?,?,1,?)
                 ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), picture_url = VALUES(picture_url),
                   status_message = VALUES(status_message), language = VALUES(language),
                   is_following = 1, followed_at = VALUES(followed_at), unfollowed_at = NULL',
                [$cid, $userId, $profile['displayName'] ?? null, $profile['pictureUrl'] ?? null, $profile['statusMessage'] ?? null, $profile['language'] ?? null, $now]
            );
            $fid = (int)Db::val('SELECT id FROM friends WHERE channel_id = ? AND line_user_id = ?', [$cid, $userId]);
            Scenarios::startForFollow($cid, $fid);
            break;

        case 'unfollow':
            Db::exec('UPDATE friends SET is_following = 0, unfollowed_at = ? WHERE channel_id = ? AND line_user_id = ?', [now_utc(), $cid, $userId]);
            break;

        case 'message':
            $f = Db::one('SELECT id FROM friends WHERE channel_id = ? AND line_user_id = ?', [$cid, $userId]);
            if (!$f) {
                // Webhook 設定前から友だちだった人は、最初のメッセージで把握される
                $profile = Line::profile(Line::token($ch), $userId) ?? [];
                Db::exec(
                    'INSERT IGNORE INTO friends (channel_id, line_user_id, display_name, picture_url, status_message, language, is_following, followed_at) VALUES (?,?,?,?,?,?,1,?)',
                    [$cid, $userId, $profile['displayName'] ?? null, $profile['pictureUrl'] ?? null, $profile['statusMessage'] ?? null, $profile['language'] ?? null, now_utc()]
                );
                $f = Db::one('SELECT id FROM friends WHERE channel_id = ? AND line_user_id = ?', [$cid, $userId]);
            }
            Db::exec('UPDATE friends SET last_message_at = ? WHERE id = ?', [now_utc(), $f['id']]);
            $msg = $ev['message'] ?? [];
            Db::exec(
                'INSERT INTO inbound_messages (friend_id, line_message_id, type, text, received_at) VALUES (?,?,?,?,?)',
                [$f['id'], $msg['id'] ?? null, $msg['type'] ?? 'unknown', ($msg['type'] ?? '') === 'text' ? ($msg['text'] ?? null) : null, now_utc()]
            );
            break;
    }
}

// HTTP 経由で cron を呼ぶ場合（config.php の cron_secret を設定したときだけ有効。通常は cron.php を使う）
$httpCron = function () {
    $secret = (string)Config::get('cron_secret', '');
    $given = (string)($_GET['key'] ?? '');
    if ($secret === '' || !hash_equals($secret, $given)) {
        http_response_code(404);
        echo 'not found';
        return;
    }
    $r = Cron::run();
    json_out(['ok' => true, 'result' => $r, 'skipped' => $r === null]);
};
Router::add('GET', '/cron', $httpCron, false);
Router::add('POST', '/cron', $httpCron, false);
