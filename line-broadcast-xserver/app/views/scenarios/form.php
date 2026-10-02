<?php $inputCls = 'mt-1 w-full border rounded px-3 py-2 text-sm'; ?>
<h1 class="text-xl font-semibold mb-4"><?= h($title) ?></h1>

<?php if ($stats): ?>
<section class="bg-white border rounded p-5 mb-5">
  <h2 class="font-semibold mb-1">進行状況</h2>
  <p class="text-sm text-gray-600 mb-3">開始した人：<b><?= (int)$stats['started'] ?></b> 人（進行中 <?= (int)$stats['running'] ?> ／ 完了 <?= (int)$stats['done'] ?>）</p>
  <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="bg-gray-50 text-left"><tr><th class="px-3 py-2 font-medium">ステップ</th><th class="px-3 py-2 font-medium">送る時期</th><th class="px-3 py-2 font-medium">送信済</th><th class="px-3 py-2 font-medium">送信待ち</th><th class="px-3 py-2 font-medium">失敗/スキップ</th></tr></thead>
      <tbody>
        <?php foreach ($stats['rows'] as $r): ?>
          <tr class="border-t"><td class="px-3 py-2">ステップ <?= (int)$r['no'] ?></td><td class="px-3 py-2 text-gray-600"><?= h($r['when']) ?></td><td class="px-3 py-2"><?= (int)$r['sent'] ?></td><td class="px-3 py-2"><?= (int)$r['pending'] ?></td><td class="px-3 py-2"><?= (int)$r['bad'] ?></td></tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <p class="text-xs text-gray-500 mt-2">「スキップ」は、送信前にブロックされた友だちなどです。</p>
</section>
<?php endif; ?>

<div x-data="scenarioForm(<?= h(json_encode($cfg, JSON_UNESCAPED_UNICODE)) ?>)" class="space-y-5 max-w-4xl">
  <div x-show="error" x-cloak class="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3" x-text="error"></div>

  <section class="bg-white border rounded p-5 space-y-4">
    <h2 class="font-semibold">1. 基本設定</h2>
    <button type="button" x-show="!isEdit" class="text-sm underline text-line-dark" @click="loadSample()">サンプル（初回来院フォロー）を入れてみる</button>
    <div><label class="block text-sm font-medium">シナリオ名（管理用）</label><input x-model="name" maxlength="120" class="<?= $inputCls ?>" placeholder="例：初回来院フォロー"></div>
    <div><label class="block text-sm font-medium">メモ（任意）</label><input x-model="description" maxlength="500" class="<?= $inputCls ?>"></div>
    <label class="flex items-center gap-2 text-sm"><input type="checkbox" x-model="isActive"> 有効にする（オフの間は新しい友だちに対して開始されません）</label>
  </section>

  <section class="bg-white border rounded p-5 space-y-3">
    <h2 class="font-semibold">2. いつ開始する？（きっかけ）</h2>
    <div class="flex flex-wrap gap-3 items-start">
      <label class="border rounded px-4 py-3 text-sm cursor-pointer" :class="triggerType === 'follow' ? 'bg-line-light border-line' : ''"><input type="radio" class="mr-2" value="follow" x-model="triggerType">友だち追加されたとき</label>
      <label class="border rounded px-4 py-3 text-sm cursor-pointer" :class="triggerType === 'tag_added' ? 'bg-line-light border-line' : ''"><input type="radio" class="mr-2" value="tag_added" x-model="triggerType">タグが付いたとき</label>
      <select x-show="triggerType === 'tag_added'" x-model="triggerTagId" class="border rounded px-3 py-2 text-sm self-center">
        <option value="">タグを選択</option>
        <template x-for="t in tags" :key="t.id"><option :value="String(t.id)" x-text="t.name"></option></template>
      </select>
    </div>
    <p class="text-xs text-gray-500">開始されるのは、有効にした<b>以降</b>に<span x-text="triggerWord"></span>された人からです。すでに友だちの人には送られません。同じ人に同じシナリオは 1 回だけ送られます。</p>
  </section>

  <section class="space-y-3">
    <h2 class="font-semibold">3. 何を・いつ送る？（ステップ）</h2>
    <template x-for="(step, i) in steps" :key="step._k">
      <div class="bg-white border rounded p-4 space-y-3">
        <div class="flex items-center justify-between">
          <div class="font-medium text-sm">ステップ <span x-text="i + 1"></span>
            <span class="ml-2 text-xs font-normal text-gray-500" x-text="triggerWord + 'から ' + cumulative[i]"></span></div>
          <button type="button" x-show="steps.length > 1" class="px-2 text-gray-500 hover:text-red-600" @click="steps.splice(i, 1)" title="ステップを削除">✕</button>
        </div>

        <div class="bg-gray-50 rounded p-3 text-sm space-y-2">
          <div class="text-xs text-gray-500" x-text="'送るタイミング（' + (i === 0 ? triggerWord : '前のステップ') + 'を起点にします）'"></div>
          <label class="flex flex-wrap items-center gap-2">
            <input type="radio" value="elapsed" x-model="step.mode">
            経過時間で指定：<span x-text="i === 0 ? triggerWord : '前のステップ'"></span>から
            <input type="number" min="0" x-model.number="step.value" :disabled="step.mode !== 'elapsed'" class="border rounded px-2 py-1 w-20 disabled:opacity-40">
            <select x-model="step.unit" :disabled="step.mode !== 'elapsed'" class="border rounded px-2 py-1 disabled:opacity-40">
              <option value="minute">分</option><option value="hour">時間</option><option value="day">日</option>
            </select>
            後<span x-show="step.mode === 'elapsed' && Number(step.value) === 0" class="text-xs text-gray-500">（0 = すぐ）</span>
          </label>
          <label class="flex flex-wrap items-center gap-2">
            <input type="radio" value="time" x-model="step.mode">
            日数と時刻で指定：<span x-text="i === 0 ? triggerWord : '前のステップ'"></span>の
            <input type="number" min="0" x-model.number="step.days" :disabled="step.mode !== 'time'" class="border rounded px-2 py-1 w-16 disabled:opacity-40">
            日後の
            <input type="time" x-model="step.time" :disabled="step.mode !== 'time'" class="border rounded px-2 py-1 disabled:opacity-40">
            （日本時間）
          </label>
          <div x-show="step.mode === 'time' && Number(step.days) === 0" class="text-xs text-gray-500">0 日後で、その時刻をすでに過ぎている場合はすぐに送られます。</div>
        </div>

        <div class="grid md:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
          <?php View::partial('message_editor', ['expr' => 'step.blocks']); ?>
          <div class="space-y-1">
            <div class="text-xs text-gray-500">プレビュー</div>
            <?php View::partial('message_preview', ['expr' => 'step.blocks']); ?>
          </div>
        </div>
      </div>
    </template>
    <button type="button" x-show="steps.length < 30" @click="addStep()" class="border rounded px-3 py-2 text-sm bg-white">+ ステップを追加</button>
  </section>

  <?php if ($stats): ?>
    <div class="bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs rounded p-3">
      編集の反映範囲：すでに開始している人の<b>未送信ステップ</b>は、本文が新しい内容に変わります（送信予定の日時は開始時に決まっているため変わりません）。ステップを新しく追加しても、すでに開始している人には送られません。
    </div>
  <?php endif; ?>

  <button type="button" :disabled="busy" @click="save()" class="bg-line text-white px-5 py-2 rounded text-sm disabled:opacity-50" x-text="busy ? '保存中…' : '保存'"></button>
</div>
