<?php
/**
 * LINE トーク画面風プレビュー（Alpine.js のテンプレート）。
 * @var string $expr 吹き出し配列を指す JS 式
 */
$B = $expr;
?>
<div class="bg-[#8CABD9] rounded-lg p-3 space-y-2 max-w-sm">
  <div x-show="<?= $B ?>.length === 0" class="text-xs text-white/80">メッセージを追加するとここに表示されます</div>
  <template x-for="(b, i) in <?= $B ?>" :key="b._k || i">
    <div class="flex"><div class="max-w-[92%]">
      <template x-if="b.type === 'text'">
        <div class="bg-white rounded-2xl rounded-tl-sm px-3 py-2 text-sm whitespace-pre-wrap break-words" x-text="b.text || '（本文）'"></div>
      </template>
      <template x-if="b.type === 'image'">
        <div>
          <img x-show="b.mediaId" :src="b.mediaId ? Editor.mediaSrc(b.mediaId) : null" alt="" class="rounded-lg max-h-64">
          <div x-show="!b.mediaId" class="bg-white/70 rounded-lg px-4 py-6 text-xs text-gray-500 text-center">画像未選択</div>
        </div>
      </template>
      <template x-if="b.type === 'rich'">
        <div>
          <div x-show="!b.mediaId" class="bg-white/70 rounded-lg px-4 py-6 text-xs text-gray-500 text-center">リッチメッセージ画像未選択</div>
          <div x-show="b.mediaId" class="relative rounded-lg overflow-hidden bg-white">
            <img :src="b.mediaId ? Editor.mediaSrc(b.mediaId) : null" alt="" class="block w-full">
            <template x-for="(r, k) in (Editor.layouts[b.layout] || Editor.layouts['1']).rects" :key="k">
              <div class="absolute border border-white/70 flex items-center justify-center" :style="Editor.rectStyle(r)">
                <span class="bg-black/50 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center" x-text="k + 1"></span>
              </div>
            </template>
          </div>
        </div>
      </template>
      <template x-if="b.type === 'cards'">
        <div class="flex gap-2 overflow-x-auto pb-1" style="max-width:340px">
          <template x-for="(c, ci) in b.cards" :key="c._k || ci">
            <div class="bg-white rounded-lg overflow-hidden shrink-0 w-48">
              <img x-show="c.mediaId" :src="c.mediaId ? Editor.mediaSrc(c.mediaId) : null" alt="" class="w-full aspect-[20/13] object-cover">
              <div class="p-2">
                <div class="font-bold text-sm break-words" x-text="c.title || '（タイトル）'"></div>
                <div class="text-xs text-gray-500 mt-1 break-words" x-show="c.description" x-text="c.description"></div>
              </div>
              <div class="p-2 pt-0 space-y-1">
                <template x-for="(btn, bi) in c.buttons" :key="bi">
                  <div x-show="btn.label || btn.uri" class="text-center text-xs rounded py-1.5" :class="bi === 0 ? 'bg-line text-white' : 'bg-gray-100 text-gray-700'" x-text="btn.label || 'ボタン'"></div>
                </template>
              </div>
            </div>
          </template>
        </div>
      </template>
    </div></div>
  </template>
</div>
