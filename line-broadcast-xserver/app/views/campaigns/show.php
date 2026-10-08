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

<?php
$hasLinks = count($links) > 0;
$totalClicks = array_sum(array_column($links, 'clicks'));
$anyInsightTarget = false;
foreach ($broadcasts as $b) { if (in_array($b['status'], ['sent', 'partial'], true) && (int)$b['target_all']) $anyInsightTarget = true; }
$hasSent = $sentTotal > 0;
?>
<?php if ($hasSent || $hasLinks): ?>
<section class="mt-6 space-y-6">
  <h2 class="text-lg font-semibold">配信の分析</h2>

  <div class="bg-white border rounded p-4">
    <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
      <h3 class="font-medium">リンクのクリック数（このシステムで計測）</h3>
      <?php if ($hasLinks): ?><a href="<?= url('/campaigns/' . (int)$c['id'] . '/links.csv') ?>" class="text-xs underline">CSV でダウンロード</a><?php endif; ?>
    </div>
    <?php if (!$hasLinks): ?>
      <p class="text-sm text-gray-500">この配信には、計測できるリンク（https:// で始まる、リッチメッセージのリンクとカードのボタン）がありません。</p>
    <?php else: ?>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-left"><tr>
            <th class="px-3 py-2 font-medium">リンク</th><th class="px-3 py-2 font-medium">クリック数</th>
            <th class="px-3 py-2 font-medium">クリックした人数（概数）</th><th class="px-3 py-2 font-medium">クリック率</th>
          </tr></thead>
          <tbody>
          <?php foreach ($links as $l): ?>
            <tr class="border-t align-top">
              <td class="px-3 py-2"><?= h($l['label']) ?><div class="text-xs text-gray-400 break-all"><?= h($l['url']) ?></div></td>
              <td class="px-3 py-2"><?= number_format($l['clicks']) ?></td>
              <td class="px-3 py-2"><?= number_format($l['people']) ?></td>
              <td class="px-3 py-2"><?= $sentTotal > 0 ? number_format($l['people'] / $sentTotal * 100, 1) . '%' : '-' ?></td>
            </tr>
          <?php endforeach; ?>
          </tbody>
        </table>
      </div>
      <p class="text-xs text-gray-500 mt-2">
        クリック率 ＝ クリックした人数 ÷ 送信できた人数（<?= number_format($sentTotal) ?> 人）。
        「人数」は端末とネットワークから推定した概数です（同じ人が複数の端末や回線から開くと、重複して数えることがあります）。誰がタップしたかは分かりません。
      </p>
      <?php if ($clicksByDay): ?>
        <div class="mt-3 text-xs text-gray-600">日別（日本時間）：
          <?php foreach ($clicksByDay as $d => $n): ?><span class="inline-block mr-3"><?= h(date('n/j', strtotime($d))) ?> <b><?= (int)$n ?></b> 回</span><?php endforeach; ?>
        </div>
      <?php endif; ?>
    <?php endif; ?>
  </div>

  <div class="bg-white border rounded p-4"
       x-data="{ busy: false, err: '',
         async refresh() { this.busy = true; this.err = '';
           const r = await Editor.post('/api/campaigns/<?= (int)$c['id'] ?>/insights');
           if (r.ok) { location.reload(); return; } this.err = r.data.error || '取得できませんでした'; this.busy = false; } }">
    <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
      <h3 class="font-medium">開封・クリック（LINE が集計）</h3>
      <?php if ($anyInsightTarget): ?>
        <button type="button" :disabled="busy" @click="refresh()" class="border rounded px-3 py-1 text-sm bg-white disabled:opacity-50" x-text="busy ? '取得中…' : 'LINE の集計を更新'"></button>
      <?php endif; ?>
    </div>
    <p x-show="err" x-cloak class="text-sm text-red-600 mb-2" x-text="err"></p>
    <?php if (!$anyInsightTarget): ?>
      <p class="text-sm text-gray-500">
        この配信は「タグで絞り込んだ配信」のため、LINE の仕様で開封数を取得できません（LINE が開封・クリックを集計するのは、友だち全員への配信だけです）。上のリンククリック数をご利用ください。
      </p>
    <?php else: ?>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-left"><tr>
            <th class="px-3 py-2 font-medium">アカウント</th><th class="px-3 py-2 font-medium">届いた人数</th>
            <th class="px-3 py-2 font-medium">開封した人数</th><th class="px-3 py-2 font-medium">開封率</th>
            <th class="px-3 py-2 font-medium">リンクをタップした人数</th><th class="px-3 py-2 font-medium">取得日時</th>
          </tr></thead>
          <tbody>
          <?php foreach ($broadcasts as $b): if (!(int)$b['target_all'] || !in_array($b['status'], ['sent', 'partial'], true)) continue; $in = $insights[(int)$b['id']] ?? null; ?>
            <tr class="border-t">
              <td class="px-3 py-2"><?= h($b['channel_name']) ?></td>
              <?php if ($in && $in['ready']): ?>
                <td class="px-3 py-2"><?= $in['delivered'] === null ? '-' : number_format($in['delivered']) ?></td>
                <td class="px-3 py-2"><?= $in['impression'] === null ? '-' : number_format($in['impression']) ?></td>
                <td class="px-3 py-2"><?= ($in['impression'] !== null && $in['delivered']) ? number_format($in['impression'] / $in['delivered'] * 100, 1) . '%' : '-' ?></td>
                <td class="px-3 py-2"><?= $in['click'] === null ? '-' : number_format($in['click']) ?></td>
              <?php else: ?>
                <td class="px-3 py-2 text-gray-500" colspan="4"><?= $in ? 'まだ集計されていません。配信の翌日以降に「LINE の集計を更新」を押してください。' : '「LINE の集計を更新」を押すと取得します。' ?></td>
              <?php endif; ?>
              <td class="px-3 py-2 text-gray-500"><?= $in ? h(fmt_jst($in['fetched_at'])) : '-' ?></td>
            </tr>
          <?php endforeach; ?>
          </tbody>
        </table>
      </div>
      <p class="text-xs text-gray-500 mt-2">
        開封した人数は、LINE が集計する「メッセージを表示した人数」です。配信直後や、届いた人数が少ない配信では、LINE が数字を返さないことがあります。
        数字は LINE 側で日ごとに集計されるため、配信の翌日以降に確認してください。
      </p>
    <?php endif; ?>
  </div>
</section>
<?php endif; ?>
