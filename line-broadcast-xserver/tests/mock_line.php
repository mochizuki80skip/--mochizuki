<?php
// LINE Messaging API の簡易モック。受け取ったリクエストを tests/mock_line.log に JSON Lines で記録する。
// トークンが "BAD" で始まる場合は 401 を返す。userId が "Ufail" で始まる宛先を含む multicast は 400。
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
$body = file_get_contents('php://input');
$entry = ['path' => $path, 'method' => $_SERVER['REQUEST_METHOD'], 'auth' => $auth, 'retryKey' => $_SERVER['HTTP_X_LINE_RETRY_KEY'] ?? null, 'body' => json_decode($body, true)];
file_put_contents(__DIR__ . '/mock_line.log', json_encode($entry, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND);

header('Content-Type: application/json');
if (str_starts_with($auth, 'Bearer BAD')) { http_response_code(401); echo json_encode(['message' => 'Authentication failed']); exit; }
if ($path === '/v2/bot/info') { echo json_encode(['userId' => 'Ubot', 'displayName' => 'Mock']); exit; }
if (str_starts_with($path, '/v2/bot/profile/')) { echo json_encode(['displayName' => 'テスト太郎 ' . substr($path, -4), 'userId' => basename($path), 'language' => 'ja']); exit; }
if ($path === '/v2/bot/message/multicast') {
    foreach ($entry['body']['to'] ?? [] as $to) if (str_starts_with($to, 'Ufail')) { http_response_code(400); echo json_encode(['message' => 'invalid user', 'details' => [['property' => 'to', 'message' => 'bad']]]); exit; }
}
echo '{}';
