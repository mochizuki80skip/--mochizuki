<?php
/** @var string $content */
$u = Auth::user();
$f = flash();
?><!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="csrf-token" content="<?= h(csrf_token()) ?>">
  <meta name="robots" content="noindex, nofollow">
  <title><?= h(!empty($title) ? $title . ' | 接骨院 LINE 一括配信' : '接骨院 LINE 一括配信') ?></title>
  <link rel="stylesheet" href="<?= asset('app.css') ?>">
  <script>window.APP_BASE = <?= json_encode(defined('BASE_PATH') ? BASE_PATH : '') ?>;</script>
  <script defer src="<?= asset('editor.js') ?>"></script>
  <script defer src="<?= asset('alpine.min.js') ?>"></script>
  <style>[x-cloak]{display:none !important}</style>
</head>
<body class="bg-gray-50 text-gray-900">
<?php if ($u): ?>
<header class="bg-white border-b">
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-5 gap-y-2">
    <a href="<?= url('/dashboard') ?>" class="font-bold text-line">接骨院 LINE 一括配信</a>
    <nav class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-700">
      <a href="<?= url('/dashboard') ?>" class="hover:text-line-dark">アカウント一覧</a>
      <a href="<?= url('/campaigns') ?>" class="hover:text-line-dark font-medium text-line-dark">全店舗 一括配信</a>
      <?php if ($u['role'] === 'super_admin'): ?>
        <a href="<?= url('/channels') ?>" class="hover:text-line-dark">LINE アカウント管理</a>
      <?php endif; ?>
    </nav>
    <div class="ml-auto flex items-center gap-3 text-xs text-gray-500">
      <a href="<?= url('/account/password') ?>" class="hover:underline"><?= h($u['email']) ?>（<?= $u['role'] === 'super_admin' ? '管理者' : 'オペレーター' ?>）</a>
      <form method="post" action="<?= url('/logout') ?>"><?= csrf_field() ?><button class="hover:underline text-gray-600">ログアウト</button></form>
    </div>
  </div>
</header>
<?php endif; ?>
<main class="max-w-6xl mx-auto px-4 sm:px-6 py-6">
  <?php if ($f): ?>
    <div class="mb-4 rounded border px-4 py-3 text-sm <?= $f['type'] === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-line-light border-line/30 text-gray-800' ?>"><?= h($f['message']) ?></div>
  <?php endif; ?>
  <?= $content ?>
</main>
</body>
</html>
