<?php
/**
 * メッセージ（吹き出し）エディタ。Alpine.js のテンプレート。
 * @var string $expr 吹き出し配列を指す JS 式（例: "blocks" / "step.blocks"）
 */
$B = $expr;
$input = 'w-full border rounded px-3 py-1.5 text-sm bg-white';
?>
<div>
  <div class="space-y-3">
    <template x-for="(b, i) in <?= $B ?>" :key="b._k">
      <div class="border rounded bg-gray-50 p-3 space-y-2">
        <div class="flex items-center justify-between">
          <div class="text-sm font-medium" x-text="(i + 1) + '. ' + Editor.typeLabels[b.type]"></div>
          <div class="flex items-center gap-1 text-gray-500">
            <button type="button" class="px-2 py-0.5 rounded hover:bg-gray-200 disabled:opacity-30" :disabled="i === 0" @click="Editor.move(<?= $B ?>, i, -1)" title="上へ">↑</button>
            <button type="button" class="px-2 py-0.5 rounded hover:bg-gray-200 disabled:opacity-30" :disabled="i === <?= $B ?>.length - 1" @click="Editor.move(<?= $B ?>, i, 1)" title="下へ">↓</button>
            <button type="button" class="px-2 py-0.5 rounded hover:bg-gray-200 hover:text-red-600" @click="<?= $B ?>.splice(i, 1)" title="削除">✕</button>
          </div>
        </div>

        <!-- テキスト -->
        <template x-if="b.type === 'text'">
          <textarea x-model="b.text" rows="5" maxlength="5000" class="<?= $input ?>" placeholder="本文を入力"></textarea>
        </template>

        <!-- 画像 -->
        <template x-if="b.type === 'image'">
          <div x-data="uploader" class="space-y-1">
            <div class="flex items-center gap-2">
              <img x-show="b.mediaId" :src="b.mediaId ? Editor.mediaSrc(b.mediaId) : null" alt="" class="h-14 w-14 object-cover rounded border">
              <label class="border rounded px-3 py-1.5 text-sm cursor-pointer bg-white">
                <span x-text="busy ? 'アップロード中…' : (b.mediaId ? '画像を変更' : '画像を選択')"></span>
                <input type="file" accept="image/jpeg,image/png" class="hidden" @change="pick($event, 1024, r => { b.mediaId = r.id })">
              </label>
              <button type="button" x-show="b.mediaId" class="text-xs text-gray-500 hover:text-red-600" @click="b.mediaId = ''">削除</button>
            </div>
            <div x-show="err" class="text-xs text-red-600" x-text="err"></div>
          </div>
        </template>

        <!-- リッチメッセージ -->
        <template x-if="b.type === 'rich'">
          <div class="space-y-3">
            <div x-data="uploader" class="space-y-1">
              <div class="flex items-center gap-2">
                <img x-show="b.mediaId" :src="b.mediaId ? Editor.mediaSrc(b.mediaId) : null" alt="" class="h-14 w-14 object-cover rounded border">
                <label class="border rounded px-3 py-1.5 text-sm cursor-pointer bg-white">
                  <span x-text="busy ? 'アップロード中…' : (b.mediaId ? '画像を変更' : 'リッチメッセージ画像を選択（横幅 1040px に縮小されます）')"></span>
                  <input type="file" accept="image/jpeg,image/png" class="hidden" @change="pick($event, 1040, r => { b.mediaId = r.id; b.ratio = r.height / r.width })">
                </label>
              </div>
              <div x-show="err" class="text-xs text-red-600" x-text="err"></div>
            </div>
            <div class="flex flex-wrap gap-2">
              <template x-for="k in Editor.layoutKeys" :key="k">
                <button type="button" class="px-2 py-1 rounded border text-xs" :class="b.layout === k ? 'bg-line text-white border-line' : 'bg-white'" @click="Editor.setLayout(b, k)" x-text="Editor.layouts[k].label"></button>
              </template>
            </div>
            <div class="space-y-2">
              <template x-for="(a, j) in b.areas" :key="j">
                <div class="flex gap-2 items-center">
                  <span class="text-xs w-14 text-gray-500 shrink-0" x-text="'エリア' + (j + 1)"></span>
                  <select x-model="a.kind" class="border rounded px-2 py-1.5 text-sm bg-white">
                    <option value="uri">リンク</option>
                    <option value="text">テキスト送信</option>
                  </select>
                  <input x-model="a.value" class="<?= $input ?>" :placeholder="a.kind === 'uri' ? 'https://...' : 'タップ時に送信されるテキスト'">
                </div>
              </template>
            </div>
            <input x-model="b.altText" maxlength="400" class="<?= $input ?>" placeholder="代替テキスト（通知・トーク一覧に表示されます）">
          </div>
        </template>

        <!-- カードタイプ -->
        <template x-if="b.type === 'cards'">
          <div class="space-y-3">
            <input x-model="b.altText" maxlength="400" class="<?= $input ?>" placeholder="代替テキスト（通知・トーク一覧に表示されます）">
            <template x-for="(c, ci) in b.cards" :key="c._k">
              <div class="border rounded bg-white p-3 space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <span class="font-medium" x-text="'カード ' + (ci + 1)"></span>
                  <button type="button" x-show="b.cards.length > 1" class="px-2 text-gray-500 hover:text-red-600" @click="b.cards.splice(ci, 1)" title="カードを削除">✕</button>
                </div>
                <div x-data="uploader" class="space-y-1">
                  <div class="flex items-center gap-2">
                    <img x-show="c.mediaId" :src="c.mediaId ? Editor.mediaSrc(c.mediaId) : null" alt="" class="h-14 w-14 object-cover rounded border">
                    <label class="border rounded px-3 py-1.5 text-sm cursor-pointer bg-white">
                      <span x-text="busy ? 'アップロード中…' : (c.mediaId ? '画像を変更' : '画像を選択（任意）')"></span>
                      <input type="file" accept="image/jpeg,image/png" class="hidden" @change="pick($event, 1024, r => { c.mediaId = r.id })">
                    </label>
                    <button type="button" x-show="c.mediaId" class="text-xs text-gray-500 hover:text-red-600" @click="c.mediaId = ''">削除</button>
                  </div>
                  <div x-show="err" class="text-xs text-red-600" x-text="err"></div>
                </div>
                <input x-model="c.title" maxlength="40" class="<?= $input ?>" placeholder="タイトル（40文字まで）">
                <input x-model="c.description" maxlength="60" class="<?= $input ?>" placeholder="説明文（60文字まで・任意）">
                <template x-for="(btn, bi) in c.buttons" :key="bi">
                  <div class="flex gap-2">
                    <input x-model="btn.label" maxlength="20" class="w-32 border rounded px-3 py-1.5 text-sm" placeholder="ボタン名">
                    <input x-model="btn.uri" class="<?= $input ?>" placeholder="https://...">
                    <button type="button" class="px-2 text-gray-500 hover:text-red-600" @click="c.buttons.splice(bi, 1)" title="ボタンを削除">✕</button>
                  </div>
                </template>
                <button type="button" x-show="c.buttons.length < Editor.MAX_BUTTONS" class="text-xs underline" @click="c.buttons.push({ label: '', uri: '' })">+ ボタンを追加</button>
              </div>
            </template>
            <button type="button" x-show="b.cards.length < Editor.MAX_CARDS" class="border rounded px-3 py-1.5 text-sm bg-white" @click="b.cards.push(Editor.newCard())">+ カードを追加（最大 10 枚）</button>
          </div>
        </template>
      </div>
    </template>
  </div>

  <div class="flex flex-wrap gap-2 mt-3" x-show="<?= $B ?>.length < Editor.MAX_BLOCKS">
    <template x-for="t in ['text', 'image', 'rich', 'cards']" :key="t">
      <button type="button" class="border rounded px-3 py-1.5 text-sm bg-white" @click="<?= $B ?>.push(Editor.prep([Editor.newBlock(t)])[0])" x-text="'+ ' + Editor.typeLabels[t]"></button>
    </template>
    <span class="text-xs text-gray-500 self-center">最大 5 つまで</span>
  </div>
</div>
