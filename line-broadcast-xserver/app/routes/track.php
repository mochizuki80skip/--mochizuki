<?php
declare(strict_types=1);

// 配信メッセージ内のリンクのクリック計測。友だちがタップすると、ここで数えて本来の URL へ転送する（認証不要）。
Router::get('/r/{token}', function (array $p) {
    $to = Analytics::hit((string)$p['token'], (string)($_SERVER['REMOTE_ADDR'] ?? ''), (string)($_SERVER['HTTP_USER_AGENT'] ?? ''));
    if ($to === null) {
        http_response_code(404);
        View::render('error', ['title' => 'ページが見つかりません', 'message' => 'お探しのページは存在しません。'], 'layout');
        return;
    }
    header('Cache-Control: no-store');
    header('Location: ' . $to, true, 302);
    exit;
});
