<div class="flex items-center justify-between mb-4">
  <h1 class="text-2xl font-semibold">LINE アカウント管理</h1>
  <a href="<?= url('/channels/new') ?>" class="bg-line text-white px-3 py-1.5 rounded text-sm">+ LINE アカウント追加</a>
</div>
<div class="bg-white border rounded overflow-x-auto">
  <table class="w-full text-sm">
    <thead class="bg-gray-50 text-left"><tr><th class="px-4 py-2 font-medium">名前</th><th class="px-4 py-2 font-medium">友だち数</th><th class="px-4 py-2 font-medium">担当者数</th><th class="px-4 py-2 font-medium">状態</th><th></th></tr></thead>
    <tbody>
      <?php foreach ($channels as $c): ?>
        <tr class="border-t">
          <td class="px-4 py-2"><span class="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle" style="background:<?= h($c['color']) ?>"></span><?= h($c['name']) ?></td>
          <td class="px-4 py-2"><?= number_format((int)$c['followers']) ?></td>
          <td class="px-4 py-2"><?= (int)$c['members'] ?></td>
          <td class="px-4 py-2"><?= (int)$c['is_active'] ? '<span class="text-line-dark">有効</span>' : '<span class="text-gray-400">無効</span>' ?></td>
          <td class="px-4 py-2 text-right"><a class="text-line-dark hover:underline" href="<?= url('/c/' . $c['id'] . '/settings') ?>">設定（Webhook URL）</a></td>
        </tr>
      <?php endforeach; ?>
      <?php if (!$channels): ?><tr><td colspan="5" class="px-4 py-6 text-gray-500">アカウントがありません。</td></tr><?php endif; ?>
    </tbody>
  </table>
</div>
