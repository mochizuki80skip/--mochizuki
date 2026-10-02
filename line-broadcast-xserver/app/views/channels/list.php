<div class="flex items-center justify-between mb-4">
  <h1 class="text-2xl font-semibold">LINE アカウント管理</h1>
  <a href="<?= url('/channels/new') ?>" class="bg-line text-white px-3 py-1.5 rounded text-sm">+ LINE アカウント追加</a>
</div>
<?php $accessKey = (string)Config::get('access_key', ''); ?>
<div class="bg-white border rounded p-4 mb-4 text-sm" x-data="{ copied: false }">
  <div class="font-medium mb-1">スタッフ共有用のアクセス URL</div>
  <?php if ($accessKey !== ''): ?>
    <div class="flex gap-2">
      <input readonly value="<?= h(public_base_url() . '/?k=' . $accessKey) ?>" onclick="this.select()" class="flex-1 border rounded px-3 py-2 text-xs font-mono">
      <button type="button" class="border px-3 py-2 rounded text-sm" @click="navigator.clipboard.writeText('<?= h(public_base_url() . '/?k=' . $accessKey) ?>'); copied = true; setTimeout(() => copied = false, 1500)" x-text="copied ? 'コピーしました' : 'コピー'"></button>
    </div>
    <p class="text-xs text-gray-500 mt-1">このURLを最初に開いた端末だけがログイン画面を見られます（以降はキー無しの URL で開けます）。URLが外部に漏れたら、<code>app/config.php</code> の <code>access_key</code> を別の文字列に変えてください（全端末で再度キー付きURLを開く必要があります）。</p>
  <?php else: ?>
    <p class="text-xs text-yellow-700">アクセスキーが未設定です。<code>app/config.php</code> に <code>'access_key' => '英数字16文字以上'</code> を追加すると、キーを知らない人にはサイトが存在しないように見えます。</p>
  <?php endif; ?>
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
