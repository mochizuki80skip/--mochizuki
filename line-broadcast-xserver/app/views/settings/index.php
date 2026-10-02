<h1 class="text-xl font-semibold mb-4">設定 — <?= h($channel['name']) ?></h1>
<?php if (!$isAdmin): ?><div class="mb-4 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm p-3 rounded">設定の変更は管理者のみ可能です。</div><?php endif; ?>

<section class="bg-white border rounded p-5 mb-5" x-data="{ url: <?= h(json_encode($webhookUrl, JSON_UNESCAPED_SLASHES)) ?>, copied: false }">
  <h2 class="font-medium mb-2">LINE Webhook URL（アカウントごとに異なります）</h2>
  <ol class="text-sm text-gray-600 mb-3 list-decimal pl-5 space-y-0.5">
    <li>下の URL をコピー</li>
    <li>LINE Developers Console → 該当チャネル →「Messaging API設定」→「Webhook URL」に貼り付けて更新</li>
    <li>「検証」を押して成功を確認</li>
    <li>「Webhookの利用」をオンにする</li>
  </ol>
  <div class="flex gap-2">
    <input readonly :value="url" class="flex-1 border rounded px-3 py-2 text-sm font-mono">
    <button type="button" class="border px-3 py-2 rounded text-sm" @click="navigator.clipboard.writeText(url); copied = true; setTimeout(() => copied = false, 1500)" x-text="copied ? 'コピーしました' : 'コピー'"></button>
  </div>
</section>

<?php if ($isAdmin): ?>
<section class="bg-white border rounded p-5 mb-5 space-y-4" x-data="{ f: <?= h(json_encode(['name' => $channel['name'], 'description' => $channel['description'] ?? '', 'color' => $channel['color'], 'isActive' => (bool)$channel['is_active'], 'accessToken' => '', 'channelSecret' => ''], JSON_UNESCAPED_UNICODE)) ?>, busy: false, msg: '', err: '',
  async save() { this.busy = true; this.msg = this.err = '';
    const r = await Editor.post('/api/c/<?= (int)$channel['id'] ?>/settings', this.f);
    this.busy = false;
    if (r.ok) { this.msg = '保存しました'; this.f.accessToken = this.f.channelSecret = ''; } else { this.err = r.data.error || '保存に失敗しました'; } } }">
  <h2 class="font-medium">アカウント情報</h2>
  <div x-show="err" x-cloak class="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded" x-text="err"></div>
  <div x-show="msg" x-cloak class="bg-line-light border border-line/30 text-sm p-3 rounded" x-text="msg"></div>
  <div class="grid sm:grid-cols-2 gap-4">
    <div><label class="block text-sm font-medium">表示名</label><input x-model="f.name" class="mt-1 w-full border rounded px-3 py-2 text-sm"></div>
    <div><label class="block text-sm font-medium">説明</label><input x-model="f.description" class="mt-1 w-full border rounded px-3 py-2 text-sm"></div>
    <div><label class="block text-sm font-medium">カラー</label><input type="color" x-model="f.color" class="mt-1 w-16 h-9 rounded border"></div>
    <label class="flex items-center gap-2 text-sm mt-6"><input type="checkbox" x-model="f.isActive"> 有効（オフにすると配信・Webhook が止まります）</label>
  </div>
  <hr>
  <div class="text-sm text-gray-600">トークンやシークレットを再発行したときだけ入力してください（空欄なら変更しません。保存時に LINE へ接続確認します）。</div>
  <textarea x-model="f.accessToken" rows="2" class="w-full border rounded px-3 py-2 text-xs font-mono" placeholder="新しいチャネルアクセストークン（長期）"></textarea>
  <input x-model="f.channelSecret" class="w-full border rounded px-3 py-2 text-sm font-mono" placeholder="新しいチャネルシークレット">
  <button @click="save()" :disabled="busy" class="bg-line text-white px-4 py-2 rounded text-sm disabled:opacity-50" x-text="busy ? '保存中…' : '保存'"></button>
</section>

<section class="bg-white border rounded p-5 mb-5">
  <h2 class="font-medium mb-1">担当者（このアカウントを操作できる人）</h2>
  <p class="text-xs text-gray-500 mb-3">管理者は全アカウントを操作できます。ここに追加した人（オペレーター）は、このアカウントだけ操作・配信できます。</p>
  <ul class="divide-y mb-4 text-sm">
    <?php foreach ($members as $m): ?>
      <li class="py-2 flex items-center justify-between"><span><?= h($m['email']) ?><?= $m['name'] ? '（' . h($m['name']) . '）' : '' ?></span>
        <form method="post" action="<?= url('/c/' . $channel['id'] . '/members/' . $m['id'] . '/remove') ?>" onsubmit="return confirm('この担当者を外しますか？')"><?= csrf_field() ?><button class="text-xs text-red-600 underline">外す</button></form></li>
    <?php endforeach; ?>
    <?php if (!$members): ?><li class="py-2 text-gray-500">担当者はまだいません。</li><?php endif; ?>
  </ul>
  <form method="post" action="<?= url('/c/' . $channel['id'] . '/members') ?>" class="grid sm:grid-cols-4 gap-2 items-end">
    <?= csrf_field() ?>
    <input type="email" name="email" required placeholder="メールアドレス" class="border rounded px-3 py-2 text-sm">
    <input name="name" placeholder="氏名（新規のみ）" class="border rounded px-3 py-2 text-sm">
    <input type="password" name="password" placeholder="パスワード（新規のみ・8文字以上）" class="border rounded px-3 py-2 text-sm">
    <button class="bg-line text-white rounded px-3 py-2 text-sm">追加</button>
  </form>
</section>

<section class="bg-white border border-red-200 rounded p-5">
  <h2 class="font-medium text-red-700 mb-1">アカウントの削除</h2>
  <p class="text-xs text-gray-500 mb-3">友だち・タグ・配信履歴・ステップ配信がすべて削除されます。元に戻せません。確認のため、アカウント名を入力してください。</p>
  <form method="post" action="<?= url('/c/' . $channel['id'] . '/delete') ?>" class="flex gap-2" onsubmit="return confirm('本当に削除しますか？')">
    <?= csrf_field() ?>
    <input name="confirm_name" placeholder="<?= h($channel['name']) ?>" class="flex-1 border rounded px-3 py-2 text-sm">
    <button class="border border-red-300 text-red-700 rounded px-3 py-2 text-sm">削除</button>
  </form>
</section>
<?php endif; ?>
