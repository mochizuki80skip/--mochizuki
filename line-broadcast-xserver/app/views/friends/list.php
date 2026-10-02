<h1 class="text-xl font-semibold mb-4">友だち <span class="text-sm font-normal text-gray-500">（<?= number_format($total) ?> 件）</span></h1>
<form method="get" class="flex flex-wrap gap-2 mb-4">
  <input name="q" value="<?= h($q) ?>" placeholder="名前で検索" class="border rounded px-3 py-2 text-sm bg-white">
  <select name="tag" class="border rounded px-3 py-2 text-sm bg-white">
    <option value="">すべてのタグ</option>
    <?php foreach ($tags as $t): ?><option value="<?= (int)$t['id'] ?>" <?= $tagId === (int)$t['id'] ? 'selected' : '' ?>><?= h($t['name']) ?></option><?php endforeach; ?>
  </select>
  <button class="border rounded px-4 py-2 text-sm bg-white">検索</button>
</form>
<div class="bg-white border rounded overflow-x-auto">
  <table class="w-full text-sm">
    <thead class="bg-gray-50 text-left"><tr><th class="px-4 py-2 font-medium">名前</th><th class="px-4 py-2 font-medium">タグ</th><th class="px-4 py-2 font-medium">状態</th><th class="px-4 py-2 font-medium">追加日</th></tr></thead>
    <tbody>
      <?php foreach ($friends as $f): ?>
        <tr class="border-t">
          <td class="px-4 py-2"><a class="text-line-dark hover:underline" href="<?= url('/c/' . $channel['id'] . '/friends/' . $f['id']) ?>"><?= h($f['display_name'] ?: '(名前未取得)') ?></a></td>
          <td class="px-4 py-2"><?php foreach ($tagsByFriend[(int)$f['id']] ?? [] as $t): ?><span class="inline-block text-xs text-white rounded px-2 py-0.5 mr-1" style="background:<?= h($t['color']) ?>"><?= h($t['name']) ?></span><?php endforeach; ?></td>
          <td class="px-4 py-2"><?= (int)$f['is_following'] ? '友だち' : '<span class="text-gray-400">ブロック/解除</span>' ?></td>
          <td class="px-4 py-2 text-gray-500"><?= h(fmt_jst($f['followed_at'], false)) ?></td>
        </tr>
      <?php endforeach; ?>
      <?php if (!$friends): ?><tr><td colspan="4" class="px-4 py-6 text-gray-500">友だちがいません。Webhook を設定すると、友だち追加が自動で反映されます。</td></tr><?php endif; ?>
    </tbody>
  </table>
</div>
<?php if ($pages > 1): ?>
  <div class="flex gap-2 mt-4 text-sm">
    <?php for ($i = 1; $i <= $pages; $i++): ?>
      <a class="px-3 py-1 border rounded <?= $i === $page ? 'bg-line text-white border-line' : 'bg-white' ?>" href="?q=<?= urlencode($q) ?>&tag=<?= $tagId ?>&page=<?= $i ?>"><?= $i ?></a>
    <?php endfor; ?>
  </div>
<?php endif; ?>
