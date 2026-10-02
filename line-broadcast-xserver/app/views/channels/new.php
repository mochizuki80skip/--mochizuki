<h1 class="text-2xl font-semibold mb-4">LINE アカウント追加</h1>
<div class="max-w-xl bg-white border rounded p-5 space-y-4" x-data="{ f: { name: '', description: '', color: '#06C755', accessToken: '', channelSecret: '' }, busy: false, error: '',
  async submit() { this.busy = true; this.error = '';
    const r = await Editor.post('/api/channels', this.f);
    if (r.ok) { location.href = APP_BASE + '/c/' + r.data.id + '/settings'; return; }
    this.error = r.data.error || '追加に失敗しました'; this.busy = false; } }">
  <div x-show="error" x-cloak class="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded" x-text="error"></div>
  <div><label class="block text-sm font-medium">LINE アカウントの表示名</label>
    <input x-model="f.name" class="mt-1 w-full border rounded px-3 py-2 text-sm" placeholder="例: 渋谷店LINE"></div>
  <div><label class="block text-sm font-medium">説明（任意）</label>
    <input x-model="f.description" class="mt-1 w-full border rounded px-3 py-2 text-sm"></div>
  <div><label class="block text-sm font-medium">アクセントカラー</label>
    <input type="color" x-model="f.color" class="mt-1 w-16 h-9 rounded border"></div>
  <hr>
  <div><label class="block text-sm font-medium">チャネルアクセストークン（長期）</label>
    <textarea x-model="f.accessToken" rows="3" class="mt-1 w-full border rounded px-3 py-2 text-xs font-mono" placeholder="LINE Developers > Messaging API設定 > チャネルアクセストークン（長期）"></textarea></div>
  <div><label class="block text-sm font-medium">チャネルシークレット</label>
    <input x-model="f.channelSecret" class="mt-1 w-full border rounded px-3 py-2 text-sm font-mono" placeholder="LINE Developers > チャネル基本設定 > チャネルシークレット"></div>
  <div class="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm p-3 rounded">
    追加後に表示される「設定」画面で、アカウント専用の Webhook URL を確認し、LINE Developers Console に設定してください
    （設定しないと友だちが同期されず、タグ配信・ステップ配信が動きません）。
  </div>
  <button @click="submit()" :disabled="busy || !f.name || !f.accessToken || !f.channelSecret" class="bg-line text-white px-4 py-2 rounded text-sm disabled:opacity-50" x-text="busy ? '接続を確認中…' : 'LINE アカウントを追加'"></button>
</div>
