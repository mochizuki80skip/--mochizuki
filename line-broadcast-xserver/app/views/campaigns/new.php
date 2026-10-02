<h1 class="text-xl font-semibold mb-4">一括配信を作成</h1>
<div x-data="composer(<?= h(json_encode($cfg, JSON_UNESCAPED_UNICODE)) ?>)" class="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
  <div class="space-y-5">
    <div x-show="error" x-cloak class="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3" x-text="error"></div>

    <section class="bg-white border rounded p-4">
      <h2 class="font-semibold mb-3">1. 配信するアカウント</h2>
      <div class="flex flex-wrap gap-3 mb-2 text-xs">
        <button type="button" class="underline" @click="selectAll()">全選択</button>
        <button type="button" class="underline" @click="clearAll()">全解除</button>
        <span class="text-gray-500" x-text="channelIds.length + ' / ' + channels.length + ' 選択中（友だち計 ' + totalFollowers.toLocaleString() + ' 人）'"></span>
      </div>
      <div class="grid sm:grid-cols-2 gap-2">
        <template x-for="c in channels" :key="c.id">
          <label class="flex items-center gap-2 border rounded px-3 py-2 text-sm cursor-pointer" :class="has(c.id) ? 'bg-line-light border-line' : 'bg-white'">
            <input type="checkbox" :checked="has(c.id)" @change="toggleChannel(c.id)">
            <span class="w-2.5 h-2.5 rounded-full" :style="'background:' + c.color"></span>
            <span class="flex-1" x-text="c.name"></span>
            <span class="text-xs text-gray-500" x-text="c.followers.toLocaleString() + '人'"></span>
          </label>
        </template>
      </div>
      <p x-show="channels.length === 0" class="text-sm text-gray-500">配信できるアカウントがありません。</p>
    </section>

    <section class="bg-white border rounded p-4">
      <h2 class="font-semibold mb-3">2. 配信日時</h2>
      <div class="flex flex-wrap items-center gap-4 text-sm">
        <label class="flex items-center gap-1"><input type="radio" value="now" x-model="mode"> すぐに配信</label>
        <label class="flex items-center gap-1"><input type="radio" value="schedule" x-model="mode"> 日時を指定（日本時間）</label>
        <input type="datetime-local" x-show="mode === 'schedule'" x-model="scheduledLocal" class="border rounded px-2 py-1">
      </div>
      <p x-show="mode === 'schedule'" class="text-xs text-gray-500 mt-2">予約は 1 分間隔の定期実行（cron）で送信されます。最大 1 分程度遅れることがあります。</p>
    </section>

    <section class="bg-white border rounded p-4">
      <h2 class="font-semibold mb-3">3. オーディエンス（タグ）</h2>
      <div class="flex flex-wrap gap-2 mb-2 text-sm items-center">
        <label class="flex items-center gap-1"><input type="radio" :checked="tagNames.length === 0" @change="tagNames = []"> 友だち全員</label>
        <span class="text-gray-500">／ タグで絞り込む（いずれかのタグが付いた人）</span>
      </div>
      <div class="flex flex-wrap gap-2">
        <template x-for="t in tags" :key="t.name">
          <button type="button" class="px-3 py-1 rounded border text-sm" :class="tagNames.includes(t.name) ? 'bg-line text-white border-line' : 'bg-white'" @click="toggleTag(t.name)"
                  :title="channelIds.length - tagHave(t) > 0 ? ('選択中の ' + (channelIds.length - tagHave(t)) + ' アカウントにはこのタグがありません') : ''">
            <span x-text="t.name"></span>
            <span class="ml-1 text-xs" :class="tagNames.includes(t.name) ? 'text-white/80' : 'text-gray-400'" x-text="tagHave(t) + '/' + channelIds.length"></span>
          </button>
        </template>
        <span x-show="tags.length === 0" class="text-sm text-gray-500">タグがまだありません</span>
      </div>
      <p x-show="tagNames.length > 0" class="text-xs text-gray-500 mt-2">タグは各アカウントのタグを「名前」で突き合わせます。選んだタグが 1 つも無いアカウントには配信されません（全員に送られることはありません）。</p>
    </section>

    <section class="bg-white border rounded p-4">
      <h2 class="font-semibold mb-3">4. メッセージ</h2>
      <div class="mb-3">
        <label class="block text-sm font-medium">タイトル（管理用・友だちには表示されません）</label>
        <input x-model="title" maxlength="120" class="mt-1 w-full border rounded px-3 py-2 text-sm" placeholder="例：10月イベントのお知らせ">
      </div>
      <?php View::partial('message_editor', ['expr' => 'blocks']); ?>
    </section>

    <div class="flex flex-wrap gap-2">
      <button type="button" :disabled="busy" @click="submit('draft')" class="border rounded px-4 py-2 text-sm bg-white disabled:opacity-50">下書き保存</button>
      <button type="button" x-show="mode === 'schedule'" :disabled="busy" @click="submit('schedule')" class="bg-line text-white rounded px-4 py-2 text-sm disabled:opacity-50">予約配信する</button>
      <button type="button" x-show="mode === 'now'" :disabled="busy" @click="submit('now')" class="bg-line text-white rounded px-4 py-2 text-sm disabled:opacity-50" x-text="busy ? '配信中…' : 'いますぐ配信'"></button>
    </div>
  </div>

  <div class="lg:sticky lg:top-4 space-y-2">
    <div class="text-sm font-medium">プレビュー</div>
    <?php View::partial('message_preview', ['expr' => 'blocks']); ?>
  </div>
</div>
