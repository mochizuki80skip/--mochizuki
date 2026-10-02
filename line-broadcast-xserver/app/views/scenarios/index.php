<div class="flex items-center justify-between mb-4">
  <h1 class="text-xl font-semibold">ステップ配信</h1>
  <a href="<?= url('/c/' . $channel['id'] . '/scenarios/new') ?>" class="bg-line text-white px-3 py-1.5 rounded text-sm">+ 新規作成</a>
</div>

<div class="bg-line-light border border-line/30 rounded p-4 text-sm space-y-1 mb-4">
  <div class="font-medium">ステップ配信とは</div>
  <p class="text-gray-700">「友だち追加された」「タグが付いた」を<b>きっかけ</b>に、あらかじめ決めたメッセージを<b>自動で順番に</b>届ける機能です。
    例：追加の直後にごあいさつ → 翌日の 10:00 に来院のお礼 → 1 週間後に次回予約のご案内。</p>
  <p class="text-xs text-gray-500">※ 有効にした以降にきっかけが起きた人から開始されます（すでに友だちの人には送られません）。送信は 1 分間隔の定期実行（cron）で行われます。</p>
</div>

<?php if ($overdue > 0): ?>
  <div class="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
    送信予定を過ぎても未送信のメッセージが <?= (int)$overdue ?> 件あります。定期実行（cron）が動いているか確認してください。
  </div>
<?php endif; ?>

<div class="space-y-3">
  <?php foreach ($scenarios as $s):
    $trigger = $s['trigger_type'] === 'tag_added' ? 'タグ「' . ($s['tag_name'] ?? '（削除済み）') . '」が付いたとき' : '友だち追加されたとき';
  ?>
    <div class="bg-white border rounded p-4 space-y-3"
         x-data="scenarioRow(<?= h(json_encode(['channelId' => (int)$channel['id'], 'id' => (int)$s['id'], 'isActive' => (bool)$s['is_active']])) ?>)">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <a href="<?= url('/c/' . $channel['id'] . '/scenarios/' . $s['id']) ?>" class="font-medium text-line-dark hover:underline"><?= h($s['name']) ?></a>
          <span class="ml-2 text-xs rounded px-2 py-0.5 <?= (int)$s['is_active'] ? 'bg-line-light text-line-dark' : 'bg-gray-100 text-gray-500' ?>"><?= (int)$s['is_active'] ? '有効' : '無効' ?></span>
          <div class="text-xs text-gray-500 mt-1">開始：<?= h($trigger) ?></div>
        </div>
        <div class="text-xs text-gray-600 text-right">進行中 <b><?= (int)$s['running'] ?></b> 人 ／ 完了 <b><?= (int)$s['done'] ?></b> 人</div>
      </div>
      <ol class="flex flex-wrap gap-2 text-xs">
        <?php foreach ($s['steps'] as $i => $st):
          $m = (json_decode($st['messages'], true) ?: [])[0] ?? null;
          $label = !$m ? '' : ($m['type'] === 'text' ? str_trunc((string)$m['text'], 14) : (['image' => '[画像]', 'imagemap' => '[リッチメッセージ]', 'flex' => '[カード]'][$m['type']] ?? ''));
        ?>
          <li class="border rounded px-2 py-1 bg-gray-50"><span class="text-gray-500"><?= h($s['labels'][$i]) ?></span><span class="mx-1">→</span><?= h($label) ?></li>
        <?php endforeach; ?>
      </ol>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <a href="<?= url('/c/' . $channel['id'] . '/scenarios/' . $s['id']) ?>" class="text-sm text-line-dark hover:underline">編集・進行状況</a>
        <div class="flex-1 max-w-md space-y-2 text-right">
          <div class="flex justify-end gap-3 text-xs">
            <button type="button" class="underline" :disabled="busy" @click="toggle()" x-text="isActive ? '無効にする' : '有効にする'"></button>
            <?php if ($others): ?><button type="button" class="underline" @click="open = !open">他の店舗へコピー</button><?php endif; ?>
            <button type="button" class="underline text-red-600" :disabled="busy" @click="remove()">削除</button>
          </div>
          <div x-show="open" x-cloak class="border rounded bg-gray-50 p-3 text-left text-sm space-y-2">
            <div class="text-xs text-gray-500">コピー先では<b>「無効」</b>で作成されます。内容を確認して有効にしてください。タグがきっかけの場合、コピー先に同名タグが無ければ作成されます。</div>
            <div class="flex flex-wrap gap-x-4 gap-y-1">
              <?php foreach ($others as $o): ?>
                <label class="flex items-center gap-1"><input type="checkbox" value="<?= (int)$o['id'] ?>" @change="$event.target.checked ? targets.push(<?= (int)$o['id'] ?>) : targets = targets.filter(x => x !== <?= (int)$o['id'] ?>)"> <?= h($o['name']) ?></label>
              <?php endforeach; ?>
            </div>
            <button type="button" :disabled="busy || targets.length === 0" @click="copy()" class="bg-line text-white rounded px-3 py-1 text-xs disabled:opacity-50">コピーする</button>
          </div>
          <div x-show="msg" x-cloak class="text-xs text-gray-600" x-text="msg"></div>
        </div>
      </div>
    </div>
  <?php endforeach; ?>
  <?php if (!$scenarios): ?>
    <div class="bg-white border rounded p-6 text-sm text-gray-500">ステップ配信はまだありません。「新規作成」から、サンプル入りで試せます。</div>
  <?php endif; ?>
</div>
