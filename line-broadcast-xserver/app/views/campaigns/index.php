<div class="flex items-center justify-between mb-4">
  <h1 class="text-xl font-semibold">一括配信</h1>
  <a href="<?= url('/campaigns/new') ?>" class="bg-line text-white px-3 py-1.5 rounded text-sm">+ 新規作成</a>
</div>
<div class="bg-white border rounded overflow-x-auto">
  <table class="w-full text-sm">
    <thead class="bg-gray-50 text-left"><tr>
      <th class="px-4 py-2 font-medium">タイトル</th><th class="px-4 py-2 font-medium">状態</th><th class="px-4 py-2 font-medium">アカウント数</th>
      <th class="px-4 py-2 font-medium">対象</th><th class="px-4 py-2 font-medium">配信日時</th><th></th></tr></thead>
    <tbody>
      <?php foreach ($rows as $r):
        $st = Campaigns::summarize(explode(',', (string)$r['statuses']));
        $tags = json_decode($r['audience_tag_names'], true) ?: [];
      ?>
        <tr class="border-t">
          <td class="px-4 py-2"><?= h($r['title']) ?></td>
          <td class="px-4 py-2"><?= h(Campaigns::STATUS_LABEL[$st] ?? $st) ?></td>
          <td class="px-4 py-2"><?= (int)$r['n'] ?></td>
          <td class="px-4 py-2 text-gray-600"><?= $tags ? h(implode('、', $tags)) : '全員' ?></td>
          <td class="px-4 py-2 text-gray-500"><?= h(fmt_jst($r['scheduled_at'] ?: $r['created_at'])) ?></td>
          <td class="px-4 py-2 text-right"><a class="text-line-dark hover:underline" href="<?= url('/campaigns/' . $r['id']) ?>">詳細</a></td>
        </tr>
      <?php endforeach; ?>
      <?php if (!$rows): ?><tr><td colspan="6" class="px-4 py-6 text-gray-500">一括配信はまだありません。</td></tr><?php endif; ?>
    </tbody>
  </table>
</div>
