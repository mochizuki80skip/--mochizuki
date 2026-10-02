<a href="<?= url('/c/' . $channel['id'] . '/friends') ?>" class="text-xs text-gray-500 hover:underline">← 友だち一覧</a>
<div class="flex items-center gap-4 my-3">
  <?php if ($friend['picture_url']): ?><img src="<?= h($friend['picture_url']) ?>" alt="" class="w-14 h-14 rounded-full border"><?php endif; ?>
  <div>
    <h1 class="text-xl font-semibold"><?= h($friend['display_name'] ?: '(名前未取得)') ?></h1>
    <div class="text-xs text-gray-500">追加：<?= h(fmt_jst($friend['followed_at'])) ?> ／ <?= (int)$friend['is_following'] ? '友だち' : 'ブロック・解除済み' ?></div>
  </div>
</div>
<div class="grid md:grid-cols-2 gap-5">
  <section class="bg-white border rounded p-4">
    <h2 class="font-medium mb-2">タグ</h2>
    <div class="flex flex-wrap gap-2 mb-3">
      <?php foreach ($tags as $t): ?>
        <form method="post" action="<?= url('/c/' . $channel['id'] . '/friends/' . $friend['id'] . '/tags/' . $t['id'] . '/remove') ?>"><?= csrf_field() ?>
          <button class="text-xs text-white rounded px-2 py-1" style="background:<?= h($t['color']) ?>" title="クリックで外す"><?= h($t['name']) ?> ×</button></form>
      <?php endforeach; ?>
      <?php if (!$tags): ?><span class="text-sm text-gray-500">タグなし</span><?php endif; ?>
    </div>
    <form method="post" action="<?= url('/c/' . $channel['id'] . '/friends/' . $friend['id'] . '/tags') ?>" class="flex gap-2">
      <?= csrf_field() ?>
      <select name="tag_id" class="border rounded px-2 py-1.5 text-sm flex-1">
        <?php foreach ($allTags as $t): ?><option value="<?= (int)$t['id'] ?>"><?= h($t['name']) ?></option><?php endforeach; ?>
      </select>
      <button class="border rounded px-3 py-1.5 text-sm" <?= $allTags ? '' : 'disabled' ?>>タグを付ける</button>
    </form>
    <?php if (!$allTags): ?><p class="text-xs text-gray-500 mt-1">先に「タグ」画面でタグを作成してください。</p><?php endif; ?>
  </section>
  <section class="bg-white border rounded p-4">
    <h2 class="font-medium mb-2">メモ</h2>
    <form method="post" action="<?= url('/c/' . $channel['id'] . '/friends/' . $friend['id'] . '/notes') ?>" class="space-y-2">
      <?= csrf_field() ?>
      <textarea name="notes" rows="4" class="w-full border rounded px-3 py-2 text-sm"><?= h($friend['notes']) ?></textarea>
      <button class="border rounded px-3 py-1.5 text-sm">保存</button>
    </form>
  </section>
</div>
<section class="bg-white border rounded p-4 mt-5">
  <h2 class="font-medium mb-2">受信メッセージ</h2>
  <ul class="divide-y text-sm">
    <?php foreach ($messages as $m): ?>
      <li class="py-2"><span class="text-xs text-gray-400"><?= h(fmt_jst($m['received_at'])) ?></span><div><?= h($m['type'] === 'text' ? (string)$m['text'] : '[' . $m['type'] . ']') ?></div></li>
    <?php endforeach; ?>
    <?php if (!$messages): ?><li class="py-2 text-gray-500">受信メッセージはありません。</li><?php endif; ?>
  </ul>
</section>
