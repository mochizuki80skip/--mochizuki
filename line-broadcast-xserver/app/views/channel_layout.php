<?php
/** @var string $content  @var array $channel  @var string $active */
$u = Auth::user();
$f = flash();
$base = '/c/' . $channel['id'];
$nav = [
    ['dash', $base, 'ダッシュボード'],
    ['friends', $base . '/friends', '友だち'],
    ['tags', $base . '/tags', 'タグ'],
    ['broadcasts', $base . '/broadcasts', '配信履歴'],
    ['scenarios', $base . '/scenarios', 'ステップ配信'],
    ['settings', $base . '/settings', '設定'],
];
$channels = Auth::channels();
?><!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="csrf-token" content="<?= h(csrf_token()) ?>">
  <meta name="robots" content="noindex, nofollow">
  <title><?= h(($title ?? '') . ' | ' . $channel['name']) ?></title>
  <link rel="stylesheet" href="<?= asset('app.css') ?>">
  <script>window.APP_BASE = <?= json_encode(defined('BASE_PATH') ? BASE_PATH : '') ?>;</script>
  <script defer src="<?= asset('editor.js') ?>"></script>
  <script defer src="<?= asset('alpine.min.js') ?>"></script>
  <style>[x-cloak]{display:none !important}</style>
</head>
<body class="bg-gray-50 text-gray-900">
<div class="min-h-screen md:flex">
  <aside class="md:w-56 bg-white border-b md:border-b-0 md:border-r shrink-0">
    <div class="px-4 py-3 border-b" style="border-top:3px solid <?= h($channel['color']) ?>">
      <a href="<?= url('/dashboard') ?>" class="text-xs text-gray-500 hover:text-gray-700">← アカウント一覧</a>
      <select class="mt-1 w-full border rounded px-2 py-1 text-sm font-medium" onchange="location.href=window.APP_BASE+'/c/'+this.value">
        <?php foreach ($channels as $c): ?>
          <option value="<?= (int)$c['id'] ?>" <?= (int)$c['id'] === (int)$channel['id'] ? 'selected' : '' ?>><?= h($c['name']) ?></option>
        <?php endforeach; ?>
        <?php if (!in_array((int)$channel['id'], array_map('intval', array_column($channels, 'id')), true)): ?>
          <option value="<?= (int)$channel['id'] ?>" selected><?= h($channel['name']) ?>（無効）</option>
        <?php endif; ?>
      </select>
    </div>
    <nav class="p-3 flex md:block flex-wrap gap-1 md:space-y-1">
      <?php foreach ($nav as [$key, $href, $label]): ?>
        <a href="<?= url($href) ?>" class="block px-3 py-2 rounded text-sm <?= $active === $key ? 'bg-line-light text-line-dark font-medium' : 'text-gray-700 hover:bg-gray-100' ?>"><?= h($label) ?></a>
      <?php endforeach; ?>
    </nav>
    <div class="p-3 border-t space-y-1 text-sm">
      <a href="<?= url('/campaigns/new?channel=' . (int)$channel['id']) ?>" class="block px-3 py-2 rounded bg-line text-white text-center">このアカウントに配信</a>
      <a href="<?= url('/campaigns') ?>" class="block px-3 py-2 rounded text-line-dark bg-line-light text-center">全店舗 一括配信</a>
      <form method="post" action="<?= url('/logout') ?>"><?= csrf_field() ?><button class="px-3 py-2 text-gray-600 hover:underline w-full text-left">ログアウト</button></form>
      <div class="text-xs text-gray-400 px-3"><?= h($u['email']) ?></div>
    </div>
  </aside>
  <main class="flex-1 min-w-0 p-4 sm:p-6">
    <div class="max-w-5xl">
      <?php if ($f): ?>
        <div class="mb-4 rounded border px-4 py-3 text-sm <?= $f['type'] === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-line-light border-line/30 text-gray-800' ?>"><?= h($f['message']) ?></div>
      <?php endif; ?>
      <?= $content ?>
    </div>
  </main>
</div>
</body>
</html>
