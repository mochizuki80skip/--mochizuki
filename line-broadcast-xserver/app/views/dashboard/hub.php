<div class="flex flex-wrap items-center justify-between gap-2 mb-5">
  <h1 class="text-2xl font-semibold">LINE アカウント一覧</h1>
  <div class="flex gap-2">
    <a href="<?= url('/campaigns/new') ?>" class="bg-line text-white px-3 py-1.5 rounded text-sm">一括配信を作成</a>
    <?php if (Auth::isAdmin()): ?>
      <a href="<?= url('/channels/new') ?>" class="border px-3 py-1.5 rounded text-sm bg-white">+ LINE アカウント追加</a>
    <?php endif; ?>
  </div>
</div>
<?php if (!empty($cronStale)): ?>
  <div class="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
    定期実行（cron）が動いていません<?= $cronLast ? '（最後の実行：' . h(fmt_jst(gmdate('Y-m-d H:i:s', $cronLast))) . '）' : '（まだ一度も実行されていません）' ?>。
    予約配信とステップ配信が送信されません。サーバーパネルの「Cron設定」を確認してください（docs/Xserver導入手順書.md）。
  </div>
<?php endif; ?>
<?php if (!$channels): ?>
  <div class="bg-white border rounded p-8 text-center text-gray-500">
    <?= Auth::isAdmin() ? 'LINE アカウントがまだ登録されていません。<a class="text-line-dark hover:underline" href="' . url('/channels/new') . '">最初のアカウントを追加する →</a>' : 'アクセスできる LINE アカウントがありません。管理者にお問い合わせください。' ?>
  </div>
<?php endif; ?>
<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
  <?php foreach ($channels as $c): ?>
    <a href="<?= url('/c/' . $c['id']) ?>" class="bg-white border rounded p-5 hover:shadow-md transition block" style="border-top:3px solid <?= h($c['color']) ?>">
      <div class="font-medium text-lg"><?= h($c['name']) ?></div>
      <?php if ($c['description']): ?><div class="text-sm text-gray-500 mt-1"><?= h($c['description']) ?></div><?php endif; ?>
      <div class="mt-4 text-sm text-gray-700">友だち：<span class="font-bold text-line-dark"><?= number_format($counts[(int)$c['id']] ?? 0) ?></span> 人</div>
    </a>
  <?php endforeach; ?>
</div>
