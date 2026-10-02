<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>ログイン | 接骨院 LINE 一括配信</title>
  <link rel="stylesheet" href="<?= asset('app.css') ?>">
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center p-4">
  <form method="post" action="<?= url('/login') ?>" class="bg-white border rounded-lg p-6 w-full max-w-sm space-y-4">
    <?= csrf_field() ?>
    <h1 class="text-xl font-semibold text-line">接骨院 LINE 一括配信</h1>
    <?php if (!empty($error)): ?><div class="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3"><?= h($error) ?></div><?php endif; ?>
    <div>
      <label class="block text-sm font-medium">メールアドレス</label>
      <input type="email" name="email" required autofocus value="<?= h($email ?? '') ?>" class="mt-1 w-full border rounded px-3 py-2 text-sm">
    </div>
    <div>
      <label class="block text-sm font-medium">パスワード</label>
      <input type="password" name="password" required class="mt-1 w-full border rounded px-3 py-2 text-sm">
    </div>
    <button class="w-full bg-line text-white rounded py-2 text-sm">ログイン</button>
  </form>
</body>
</html>
