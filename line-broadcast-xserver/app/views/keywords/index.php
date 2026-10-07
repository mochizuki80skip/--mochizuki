<h1 class="text-xl font-semibold mb-1">自動タグ付け</h1>
<p class="text-sm text-gray-600 mb-4">
  友だちが送った<b>メッセージ</b>が、決めた<b>キーワード</b>と一致したら、自動で<b>タグ</b>を付けます。
  エリア別の登録用URL・QRコードや、社員だけが知る<b>合言葉</b>に使えます。付いたタグで、エリア別・社員向けに配信を分けられます。
</p>

<div class="bg-line-light border border-line/30 rounded p-4 text-sm space-y-1 mb-5">
  <div class="font-medium">使い方（エリア別の例）</div>
  <ol class="list-decimal pl-5 text-gray-700 space-y-0.5">
    <li>下のフォームで、キーワード <code>静岡エリア</code> → タグ <code>エリア：静岡</code> のルールを作る</li>
    <li>一覧に出る<b>登録用URL</b>（またはQRコード）を、静岡エリアのチラシ・ポスター・SNSで配る</li>
    <li>お客様がURLを開く → 公式LINEを友だち追加 → トーク画面に「静岡エリア」が入力済みで開く → <b>送信</b>する</li>
    <li>自動で「エリア：静岡」のタグが付く（任意で、お礼の自動返信も送れます）</li>
  </ol>
  <p class="text-xs text-gray-500">※ お客様が「送信」を押した人にタグが付きます。押さなかった人にはタグが付きません。実際のスマホで、URLを開いて確認してください。</p>
</div>

<?php if ($basicError): ?>
  <div class="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">登録用URLを作れません：<?= h($basicError) ?>（アクセストークンが正しいか、「設定」で確認してください）</div>
<?php endif; ?>

<div x-data="keywordRules(<?= h(json_encode($cfg, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) ?>)" class="space-y-5">
  <section class="bg-white border rounded p-4 space-y-3">
    <h2 class="font-semibold">ルールを追加</h2>
    <div x-show="error" x-cloak class="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3" x-text="error"></div>
    <div class="grid md:grid-cols-2 gap-3">
      <div>
        <label class="block text-sm font-medium">キーワード（お客様が送る言葉）</label>
        <input x-model="form.keyword" maxlength="100" class="mt-1 w-full border rounded px-3 py-2 text-sm" placeholder="例：静岡エリア ／ 社員の合言葉">
      </div>
      <div>
        <label class="block text-sm font-medium">一致のさせ方</label>
        <select x-model="form.matchType" class="mt-1 w-full border rounded px-3 py-2 text-sm bg-white">
          <option value="exact">完全に一致したとき（おすすめ）</option>
          <option value="contains">キーワードを含むとき（2文字以上）</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium">付けるタグ</label>
        <select x-model="form.tagChoice" class="mt-1 w-full border rounded px-3 py-2 text-sm bg-white">
          <option value="">タグを選択</option>
          <template x-for="t in tags" :key="t.id"><option :value="String(t.id)" x-text="t.name"></option></template>
          <option value="__new">＋ 新しいタグを作る</option>
        </select>
        <input x-show="form.tagChoice === '__new'" x-model="form.newTagName" maxlength="100" class="mt-2 w-full border rounded px-3 py-2 text-sm" placeholder="新しいタグ名（例：エリア：静岡）">
      </div>
      <div>
        <label class="block text-sm font-medium">自動返信（任意）</label>
        <input x-model="form.replyText" maxlength="500" class="mt-1 w-full border rounded px-3 py-2 text-sm" placeholder="例：静岡エリアで登録しました。ありがとうございます！">
      </div>
    </div>
    <p class="text-xs text-gray-500">社員向けの合言葉は、<b>推測されにくい長めの言葉</b>にしてください（例：英数字を混ぜた 10 文字以上）。合言葉を知っている人にだけ「社員」タグが付きます。</p>
    <button type="button" :disabled="busy" @click="add()" class="bg-line text-white rounded px-4 py-2 text-sm disabled:opacity-50" x-text="busy ? '追加中…' : 'ルールを追加'"></button>
  </section>

  <section class="bg-white border rounded overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="bg-gray-50 text-left"><tr>
        <th class="px-4 py-2 font-medium">キーワード</th><th class="px-4 py-2 font-medium">一致</th><th class="px-4 py-2 font-medium">付くタグ</th>
        <th class="px-4 py-2 font-medium">自動返信</th><th class="px-4 py-2 font-medium">登録用URL・QR</th><th class="px-4 py-2 font-medium">状態</th><th></th>
      </tr></thead>
      <tbody>
        <template x-for="r in rules" :key="r.id">
          <tr class="border-t align-top" :class="r.isActive ? '' : 'opacity-60'">
            <td class="px-4 py-2 font-medium" x-text="r.keyword"></td>
            <td class="px-4 py-2 text-gray-600 whitespace-nowrap" x-text="r.matchType === 'contains' ? '含む' : '完全一致'"></td>
            <td class="px-4 py-2"><span class="inline-block text-xs text-white rounded px-2 py-0.5 whitespace-nowrap" :style="'background:' + r.tagColor" x-text="r.tagName"></span></td>
            <td class="px-4 py-2 text-gray-600 max-w-[14rem] break-words" x-text="r.replyText || '-'"></td>
            <td class="px-4 py-2">
              <template x-if="r.url">
                <div class="space-x-3 text-xs">
                  <button type="button" class="underline" @click="copy(r.url)">URLをコピー</button>
                  <button type="button" class="underline" @click="showQr(r)">QRコード</button>
                </div>
              </template>
              <span x-show="!r.url" class="text-xs text-gray-400">（URLを作れません）</span>
            </td>
            <td class="px-4 py-2 whitespace-nowrap" x-text="r.isActive ? '有効' : '停止中'"></td>
            <td class="px-4 py-2 text-right text-xs space-x-3 whitespace-nowrap">
              <button type="button" class="underline" @click="toggle(r)" x-text="r.isActive ? '停止' : '再開'"></button>
              <button type="button" class="underline text-red-600" @click="remove(r)">削除</button>
            </td>
          </tr>
        </template>
        <tr x-show="rules.length === 0"><td colspan="7" class="px-4 py-6 text-gray-500">ルールはまだありません。上のフォームから追加してください。</td></tr>
      </tbody>
    </table>
  </section>
  <p x-show="copied" x-cloak class="text-xs text-line-dark">URLをコピーしました</p>

  <!-- QRコードの表示 -->
  <div x-show="qr.open" x-cloak class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" @click.self="qr.open = false">
    <div class="bg-white rounded-lg p-5 w-full max-w-sm space-y-3 text-center">
      <div class="font-semibold" x-text="qr.label"></div>
      <img :src="qr.src" alt="QRコード" class="mx-auto w-56 h-56" style="image-rendering: pixelated">
      <div class="text-xs text-gray-500 break-all" x-text="qr.url"></div>
      <div class="flex gap-2 justify-center">
        <a :href="qr.src" :download="'qr-' + qr.label + '.gif'" class="border rounded px-3 py-1.5 text-sm">画像を保存</a>
        <button type="button" class="border rounded px-3 py-1.5 text-sm" @click="qr.open = false">閉じる</button>
      </div>
    </div>
  </div>
</div>
<script defer src="<?= asset('qrcode.js') ?>"></script>
