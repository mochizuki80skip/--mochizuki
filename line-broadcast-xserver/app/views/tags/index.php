<h1 class="text-xl font-semibold mb-1">タグ</h1>
<p class="text-sm text-gray-500 mb-4">タグは友だちの分類に使い、一括配信の「オーディエンス」やステップ配信の開始条件にできます。<b>一括配信では「タグ名」で全店舗を突き合わせる</b>ので、店舗間で同じ名前にそろえてください。</p>
<form method="post" action="<?= url('/c/' . $channel['id'] . '/tags') ?>" class="flex flex-wrap gap-2 mb-4">
  <?= csrf_field() ?>
  <input name="name" required maxlength="100" placeholder="タグ名（例：イベント案内希望）" class="border rounded px-3 py-2 text-sm bg-white">
  <input type="color" name="color" value="#06C755" class="h-10 w-12 rounded border">
  <button class="bg-line text-white rounded px-4 py-2 text-sm">タグを作成</button>
</form>
<div class="bg-white border rounded divide-y">
  <?php foreach ($tags as $t): ?>
    <div class="px-4 py-2 flex items-center justify-between text-sm">
      <div><span class="inline-block text-xs text-white rounded px-2 py-0.5" style="background:<?= h($t['color']) ?>"><?= h($t['name']) ?></span> <span class="text-gray-500 ml-2"><?= (int)$t['cnt'] ?> 人</span></div>
      <form method="post" action="<?= url('/c/' . $channel['id'] . '/tags/' . $t['id'] . '/delete') ?>" onsubmit="return confirm('タグを削除します（友だちからも外れます）。よろしいですか？')"><?= csrf_field() ?><button class="text-xs text-red-600 underline">削除</button></form>
    </div>
  <?php endforeach; ?>
  <?php if (!$tags): ?><div class="px-4 py-6 text-sm text-gray-500">タグがありません。</div><?php endif; ?>
</div>
