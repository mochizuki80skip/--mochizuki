<h1 class="text-xl font-semibold mb-4"><?= h($channel['name']) ?></h1>
<?php [$qt, $ql] = quota_summary($quota ?? null); ?>
<div class="mb-4 bg-white border rounded px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-2"
     x-data="{ busy: false, async refresh() { this.busy = true; const r = await Editor.post('/api/quota/refresh', { channelIds: [<?= (int)$channel['id'] ?>] }); location.reload(); } }">
  <span class="<?= ['red' => 'text-red-600 font-medium', 'amber' => 'text-amber-600 font-medium', 'green' => 'text-gray-700', 'gray' => 'text-gray-500'][$ql] ?>"><?= h($qt) ?></span>
  <button type="button" :disabled="busy" @click="refresh()" class="border rounded px-3 py-1 text-xs bg-white disabled:opacity-50" x-text="busy ? '取得中…' : '最新にする'"></button>
</div>
<div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
  <?php foreach ($stats as $label => $v): ?>
    <div class="bg-white border rounded p-4"><div class="text-xs text-gray-500"><?= h($label) ?></div><div class="text-2xl font-bold mt-1"><?= number_format($v) ?></div></div>
  <?php endforeach; ?>
</div>
<h2 class="font-medium mb-2">最近の受信メッセージ</h2>
<div class="bg-white border rounded divide-y">
  <?php foreach ($inbound as $m): ?>
    <div class="px-4 py-2 text-sm">
      <a class="text-line-dark hover:underline" href="<?= url('/c/' . $channel['id'] . '/friends/' . $m['fid']) ?>"><?= h($m['display_name'] ?: '(名前未取得)') ?></a>
      <span class="text-gray-400 text-xs ml-2"><?= h(fmt_jst($m['received_at'])) ?></span>
      <div class="text-gray-700"><?= h($m['type'] === 'text' ? (string)$m['text'] : '[' . $m['type'] . ']') ?></div>
    </div>
  <?php endforeach; ?>
  <?php if (!$inbound): ?><div class="px-4 py-6 text-sm text-gray-500">まだ受信メッセージがありません。</div><?php endif; ?>
</div>
