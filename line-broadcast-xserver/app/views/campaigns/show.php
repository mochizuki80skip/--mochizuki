<div class="mb-4">
  <a href="<?= url('/campaigns') ?>" class="text-xs text-gray-500 hover:underline">← 一括配信</a>
  <h1 class="text-xl font-semibold mt-1"><?= h($c['title']) ?></h1>
  <div class="text-sm text-gray-500 mt-1">
    状態：<?= h(Campaigns::STATUS_LABEL[$status] ?? $status) ?> ／
    対象：<?= $tagNames ? 'タグ ' . h(implode('、', $tagNames)) : '友だち全員' ?> ／
    予約：<?= h(fmt_jst($c['scheduled_at'])) ?>
  </div>
</div>

<?php if ($pending > 0): ?>
<div class="mb-4 flex gap-2" x-data="{ busy: false, err: '',
  async run(action, msg) { if (!confirm(msg)) return; this.busy = true; this.err = '';
    const r = await Editor.post('/api/campaigns/<?= (int)$c['id'] ?>/' + action);
    if (r.ok) { location.reload(); return; } this.err = r.data.error || '失敗しました'; this.busy = false; } }">
  <button :disabled="busy" @click="run('execute', '<?= $pending ?> アカウントにいま配信します。よろしいですか？')" class="bg-line text-white rounded px-4 py-2 text-sm disabled:opacity-50" x-text="busy ? '処理中…' : 'いますぐ配信'"></button>
  <button :disabled="busy" @click="run('cancel', '未送信の配信を取り消します。よろしいですか？')" class="border rounded px-4 py-2 text-sm bg-white disabled:opacity-50">配信を取り消す</button>
  <span x-show="err" x-cloak class="text-sm text-red-600 self-center" x-text="err"></span>
</div>
<?php endif; ?>

<div class="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
  <div class="bg-white border rounded overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="bg-gray-50 text-left"><tr><th class="px-4 py-2 font-medium">アカウント</th><th class="px-4 py-2 font-medium">状態</th><th class="px-4 py-2 font-medium">対象人数</th><th class="px-4 py-2 font-medium">送信日時</th></tr></thead>
      <tbody>
        <?php foreach ($broadcasts as $b): ?>
          <tr class="border-t align-top">
            <td class="px-4 py-2"><span class="inline-block w-2.5 h-2.5 rounded-full mr-2" style="background:<?= h($b['channel_color']) ?>"></span><?= h($b['channel_name']) ?></td>
            <td class="px-4 py-2"><?= h(Campaigns::STATUS_LABEL[$b['status']] ?? $b['status']) ?>
              <?php if ($b['error_message']): ?><div class="text-xs text-red-600 mt-0.5 whitespace-pre-wrap"><?= h($b['error_message']) ?></div><?php endif; ?></td>
            <td class="px-4 py-2"><?= in_array($b['status'], ['sent', 'failed'], true) ? number_format((int)$b['total_targets']) : '-' ?></td>
            <td class="px-4 py-2 text-gray-500"><?= h(fmt_jst($b['sent_at'] ?: $b['scheduled_at'])) ?></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <div x-data="{ blocks: Editor.prep(<?= h(json_encode($blocks, JSON_UNESCAPED_UNICODE)) ?>) }">
    <?php View::partial('message_preview', ['expr' => 'blocks']); ?>
  </div>
</div>
