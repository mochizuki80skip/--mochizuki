<?php
declare(strict_types=1);

// ブラウザで行う初期セットアップ（データベース作成・設定ファイル作成・管理者作成）。
// 完了後はこのファイルを必ず削除してください（自動削除も試みます）。
$appDir = is_dir(__DIR__ . '/../app') ? __DIR__ . '/../app' : __DIR__ . '/app';
require $appDir . '/bootstrap.php';
define('BASE_PATH', detect_base_path(__DIR__));

function page(string $body): void
{
    echo '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">'
        . '<title>セットアップ | 接骨院 LINE 一括配信</title><link rel="stylesheet" href="' . h(url('/assets/app.css')) . '"></head>'
        . '<body class="bg-gray-50 min-h-screen py-10 px-4"><div class="max-w-xl mx-auto">' . $body . '</div></body></html>';
    exit;
}

if (Config::exists()) {
    page('<div class="bg-white border rounded-lg p-6 space-y-3"><h1 class="text-lg font-semibold">セットアップ済みです</h1>'
        . '<p class="text-sm text-gray-600">すでに設定ファイルがあります。安全のため、サーバー上の <code>install.php</code> を削除してください。</p>'
        . '<a class="text-line-dark underline text-sm" href="' . h(url('/login')) . '">ログイン画面へ</a></div>');
}

$errors = [];
$v = [
    'db_host' => 'localhost', 'db_name' => '', 'db_user' => '', 'db_pass' => '',
    'base_url' => ((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https' ? 'https' : 'http')
        . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . BASE_PATH,
    'email' => '',
];

// 動作環境のチェック
$checks = [
    'PHP 8.1 以上（現在 ' . PHP_VERSION . '）' => version_compare(PHP_VERSION, '8.1.0', '>='),
    'PDO MySQL' => extension_loaded('pdo_mysql'),
    'cURL' => extension_loaded('curl'),
    'OpenSSL' => extension_loaded('openssl'),
    'mbstring' => extension_loaded('mbstring'),
    'config.php を作成できる（app フォルダが書き込み可）' => is_writable($appDir),
    'storage/media に書き込める' => is_writable($appDir . '/storage/media'),
    'storage/logs に書き込める' => is_writable($appDir . '/storage/logs'),
];
$envOk = !in_array(false, $checks, true);

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $envOk) {
    foreach (array_keys($v) as $k) $v[$k] = trim((string)($_POST[$k] ?? ''));
    $password = (string)($_POST['password'] ?? '');
    $v['base_url'] = rtrim($v['base_url'], '/');

    if (!filter_var($v['email'], FILTER_VALIDATE_EMAIL)) $errors[] = '管理者のメールアドレスが正しくありません。';
    if (mb_strlen($password) < 8) $errors[] = '管理者パスワードは 8 文字以上にしてください。';
    if (!preg_match('#^https?://#', $v['base_url'])) $errors[] = '公開URLは https:// から入力してください。';
    if ($v['db_name'] === '' || $v['db_user'] === '') $errors[] = 'データベース名とユーザー名を入力してください。';

    if (!$errors) {
        try {
            $pdo = new PDO("mysql:host={$v['db_host']};dbname={$v['db_name']};charset=utf8mb4", $v['db_user'], $v['db_pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
            foreach (preg_split('/;\s*\n/', (string)file_get_contents($appDir . '/schema.sql')) as $stmt) {
                $stmt = trim(preg_replace('/^--.*$/m', '', $stmt));
                if ($stmt !== '') $pdo->exec($stmt);
            }
            $exists = $pdo->prepare('SELECT COUNT(*) FROM admin_users');
            $exists->execute();
            if ((int)$exists->fetchColumn() === 0) {
                $pdo->prepare("INSERT INTO admin_users (email, password_hash, name, role, created_at) VALUES (?,?,?,'super_admin',?)")
                    ->execute([$v['email'], password_hash($password, PASSWORD_DEFAULT), '管理者', gmdate('Y-m-d H:i:s')]);
            }
            $config = [
                'db' => ['host' => $v['db_host'], 'name' => $v['db_name'], 'user' => $v['db_user'], 'pass' => $v['db_pass']],
                'base_url' => $v['base_url'],
                'app_key' => Crypto::generateKey(),
                'cron_secret' => '',
                'line_api_base' => 'https://api.line.me',
                'debug' => false,
            ];
            $written = file_put_contents($appDir . '/config.php', "<?php\n// install.php により自動生成。秘密情報を含むため公開しないこと。\nreturn " . var_export($config, true) . ";\n", LOCK_EX);
            if ($written === false) throw new RuntimeException('config.php を書き込めませんでした');
            @chmod($appDir . '/config.php', 0600);
            $deleted = @unlink(__FILE__);
            page('<div class="bg-white border rounded-lg p-6 space-y-3"><h1 class="text-lg font-semibold text-line">セットアップが完了しました</h1>'
                . '<p class="text-sm">管理者としてログインできます。</p>'
                . ($deleted ? '<p class="text-sm text-gray-600">install.php は自動で削除しました。</p>'
                    : '<p class="text-sm text-red-600 font-medium">安全のため、サーバー上の install.php を今すぐ削除してください（自動削除できませんでした）。</p>')
                . '<p class="text-sm text-gray-600">次に、定期実行（cron）を設定してください。手順は docs/Xserver導入手順書.md を参照。</p>'
                . '<a class="inline-block bg-line text-white rounded px-4 py-2 text-sm" href="' . h(url('/login')) . '">ログイン画面へ</a></div>');
        } catch (Throwable $e) {
            $errors[] = '失敗しました：' . $e->getMessage();
        }
    }
}

ob_start(); ?>
<form method="post" class="bg-white border rounded-lg p-6 space-y-5">
  <h1 class="text-xl font-semibold text-line">接骨院 LINE 一括配信 セットアップ</h1>
  <div>
    <div class="text-sm font-medium mb-1">動作環境のチェック</div>
    <ul class="text-sm space-y-0.5">
      <?php foreach ($checks as $label => $ok): ?>
        <li class="<?= $ok ? 'text-gray-700' : 'text-red-600 font-medium' ?>"><?= $ok ? '✔' : '✘' ?> <?= h($label) ?></li>
      <?php endforeach; ?>
    </ul>
  </div>
  <?php if ($errors): ?><div class="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3"><?php foreach ($errors as $e) echo '<div>' . h($e) . '</div>'; ?></div><?php endif; ?>
  <?php if ($envOk): ?>
  <fieldset class="space-y-3">
    <legend class="text-sm font-semibold mb-1">データベース（サーバーパネルで作成した MySQL）</legend>
    <?php foreach ([['db_host', 'MySQL ホスト名', 'text'], ['db_name', 'データベース名', 'text'], ['db_user', 'ユーザー名', 'text'], ['db_pass', 'パスワード', 'password']] as [$k, $label, $type]): ?>
      <div><label class="block text-sm"><?= h($label) ?></label><input type="<?= $type ?>" name="<?= $k ?>" value="<?= h($type === 'password' ? '' : $v[$k]) ?>" class="mt-1 w-full border rounded px-3 py-2 text-sm"></div>
    <?php endforeach; ?>
  </fieldset>
  <fieldset class="space-y-3">
    <legend class="text-sm font-semibold mb-1">このシステムの公開URL</legend>
    <input name="base_url" value="<?= h($v['base_url']) ?>" class="w-full border rounded px-3 py-2 text-sm">
    <p class="text-xs text-gray-500">LINE が画像を取得する URL の起点です。https:// から始まる、実際にアクセスする URL（末尾スラッシュなし）。</p>
  </fieldset>
  <fieldset class="space-y-3">
    <legend class="text-sm font-semibold mb-1">管理者アカウント</legend>
    <div><label class="block text-sm">メールアドレス</label><input type="email" name="email" value="<?= h($v['email']) ?>" class="mt-1 w-full border rounded px-3 py-2 text-sm"></div>
    <div><label class="block text-sm">パスワード（8文字以上）</label><input type="password" name="password" class="mt-1 w-full border rounded px-3 py-2 text-sm"></div>
  </fieldset>
  <button class="bg-line text-white rounded px-5 py-2 text-sm">セットアップを実行</button>
  <?php else: ?>
    <p class="text-sm text-red-600">✘ の項目を解消してからページを再読み込みしてください（docs/Xserver導入手順書.md 参照）。</p>
  <?php endif; ?>
</form>
<?php page((string)ob_get_clean());
