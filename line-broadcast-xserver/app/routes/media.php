<?php
declare(strict_types=1);

// 配信用画像のアップロード（ブラウザで縮小済みの JPEG/PNG）
Router::post('/api/media', function () {
    Auth::requireLogin();
    $f = $_FILES['file'] ?? null;
    if (!$f || ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        json_error(($f['error'] ?? 0) === UPLOAD_ERR_INI_SIZE ? '画像が大きすぎます' : 'ファイルがアップロードされていません');
    }
    if ($f['size'] > 3 * 1024 * 1024) json_error('画像が大きすぎます（3MB まで）', 413);
    $info = @getimagesize($f['tmp_name']);
    $mime = $info['mime'] ?? '';
    if (!$info || !in_array($mime, ['image/jpeg', 'image/png'], true)) json_error('JPEG / PNG のみアップロードできます');

    $id = bin2hex(random_bytes(16));
    $dir = APP_DIR . '/storage/media';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    if (!move_uploaded_file($f['tmp_name'], $dir . '/' . $id)) json_error('画像の保存に失敗しました。storage/media の書き込み権限を確認してください', 500);
    Db::exec('INSERT INTO media (id, content_type, width, height, size, created_at) VALUES (?,?,?,?,?,?)', [$id, $mime, $info[0], $info[1], (int)$f['size'], now_utc()]);
    json_out(['id' => $id, 'width' => $info[0], 'height' => $info[1]]);
});

// LINE（imagemap は /media/{id}/1040 のようにサイズ違いを要求する）と管理画面から取得される。認証不要。
// ID は推測できない 32 桁。サイズ違いは同じ画像を返す（アップロード時に縮小済み）。
$serveMedia = function (array $p) {
    $id = (string)$p['id'];
    $m = preg_match('/^[a-f0-9]{32}$/', $id) ? Db::one('SELECT content_type, size FROM media WHERE id = ?', [$id]) : null;
    $file = APP_DIR . '/storage/media/' . $id;
    if (!$m || !is_file($file)) {
        http_response_code(404);
        echo 'not found';
        return;
    }
    header('Content-Type: ' . $m['content_type']);
    header('Content-Length: ' . filesize($file));
    header('Cache-Control: public, max-age=31536000, immutable');
    header('X-Content-Type-Options: nosniff');
    readfile($file);
};
Router::get('/media/{id}', $serveMedia);
Router::get('/media/{id}/{size}', $serveMedia);
