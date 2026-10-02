<div class="flex items-center justify-between mb-4">
  <h1 class="text-xl font-semibold">配信履歴</h1>
  <a href="<?= url('/campaigns/new?channel=' . $channel['id']) ?>" class="bg-line text-white px-3 py-1.5 rounded text-sm">このアカウントに配信を作成</a>
</div>
<div class="bg-white border rounded overflow-x-auto">
  <table class="w-full text-sm">
    <thead class="bg-gray-50 text-left"><tr><th class="px-4 py-2 font-medium">タイトル</th><th class="px-4 py-2 font-medium">状態</th><th class="px-4 py-2 font-medium">対象人数</th><th class="px-4 py-2 font-medium">日時</th><th></th></tr></thead>
    <tbody>
      <?php foreach ($rows as $b): ?>
        <tr class="border-t align-top">
          <td class="px-4 py-2"><?= h($b['title']) ?></td>
          <td class="px-4 py-2"><?= h(Campaigns::STATUS_LABEL[$b['status']] ?? $b['status']) ?><?php if ($b['error_message']): ?><div class="text-xs text-red-600 whitespace-pre-wrap"><?= h($b['error_message']) ?></div><?php endif; ?></td>
          <td class="px-4 py-2"><?= in_array($b['status'], ['sent', 'failed'], true) ? number_format((int)$b['total_targets']) : '-' ?></td>
          <td class="px-4 py-2 text-gray-500"><?= h(fmt_jst($b['sent_at'] ?: $b['scheduled_at'] ?: $b['created_at'])) ?></td>
          <td class="px-4 py-2 text-right"><a class="text-line-dark hover:underline" href="<?= url('/campaigns/' . $b['campaign_id']) ?>">詳細</a></td>
        </tr>
      <?php endforeach; ?>
      <?php if (!$rows): ?><tr><td colspan="5" class="px-4 py-6 text-gray-500">配信はまだありません。</td></tr><?php endif; ?>
    </tbody>
  </table>
</div>
