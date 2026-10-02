// メッセージエディタ共通ロジック（Alpine.js 用）。一括配信・ステップ配信の両方で使う。
(function () {
  var seq = 0;

  var LAYOUTS = {
    '1':  { label: '全面 1 つ',   rects: [[0, 0, 1, 1]] },
    '2h': { label: '左右 2 分割', rects: [[0, 0, .5, 1], [.5, 0, .5, 1]] },
    '2v': { label: '上下 2 分割', rects: [[0, 0, 1, .5], [0, .5, 1, .5]] },
    '3c': { label: '3 列',        rects: [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]] },
    '4':  { label: '4 分割',      rects: [[0, 0, .5, .5], [.5, 0, .5, .5], [0, .5, .5, .5], [.5, .5, .5, .5]] },
    '6':  { label: '6 分割',      rects: [[0, 0, 1 / 3, .5], [1 / 3, 0, 1 / 3, .5], [2 / 3, 0, 1 / 3, .5], [0, .5, 1 / 3, .5], [1 / 3, .5, 1 / 3, .5], [2 / 3, .5, 1 / 3, .5]] }
  };

  var Editor = {
    MAX_BLOCKS: 5, MAX_CARDS: 10, MAX_BUTTONS: 3,
    layouts: LAYOUTS,
    layoutKeys: Object.keys(LAYOUTS),
    typeLabels: { text: 'テキスト', image: '画像', rich: 'リッチメッセージ', cards: 'カードタイプ' },

    key: function () { return 'k' + (++seq) + Math.random().toString(36).slice(2, 6); },
    csrf: function () { var m = document.querySelector('meta[name="csrf-token"]'); return m ? m.content : ''; },
    mediaSrc: function (id) { return (window.APP_BASE || '') + '/media/' + id; },

    // JSON を POST（CSRF トークン付き）
    post: function (path, data) {
      return fetch((window.APP_BASE || '') + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': Editor.csrf() },
        body: JSON.stringify(data || {})
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) { return { ok: res.ok, status: res.status, data: body }; });
      }).catch(function () { return { ok: false, status: 0, data: { error: '通信に失敗しました。ネットワークを確認してください' } }; });
    },

    newCard: function () { return { _k: Editor.key(), title: '', description: '', buttons: [{ label: '', uri: '' }] }; },
    newBlock: function (type) {
      var b = { _k: Editor.key(), type: type };
      if (type === 'text') b.text = '';
      if (type === 'image') b.mediaId = '';
      if (type === 'rich') { b.mediaId = ''; b.ratio = 1; b.layout = '1'; b.areas = [{ kind: 'uri', value: '' }]; b.altText = ''; }
      if (type === 'cards') { b.altText = ''; b.cards = [Editor.newCard()]; }
      return b;
    },
    // サーバから受け取ったブロックに、並べ替え用のキーを付ける
    prep: function (blocks) {
      (blocks || []).forEach(function (b) {
        b._k = b._k || Editor.key();
        (b.cards || []).forEach(function (c) { c._k = c._k || Editor.key(); });
      });
      return blocks;
    },
    // 送信用にキーを除いたコピー
    clean: function (blocks) {
      return JSON.parse(JSON.stringify(blocks, function (k, v) { return k === '_k' ? undefined : v; }));
    },
    move: function (arr, i, d) {
      var j = i + d;
      if (j < 0 || j >= arr.length) return;
      var t = arr[i]; arr.splice(i, 1); arr.splice(j, 0, t);
    },
    setLayout: function (b, key) {
      var n = LAYOUTS[key].rects.length;
      var areas = [];
      for (var i = 0; i < n; i++) areas.push(b.areas[i] || { kind: 'uri', value: '' });
      b.layout = key;
      b.areas = areas;
    },
    rectStyle: function (r) {
      return 'left:' + r[0] * 100 + '%;top:' + r[1] * 100 + '%;width:' + r[2] * 100 + '%;height:' + r[3] * 100 + '%';
    },

    // 画像を縮小して JPEG 化し、サーバへアップロードする（LINE の画像サイズ上限・サーバのアップロード上限対策）
    upload: async function (file, maxWidth) {
      if (!file) throw new Error('ファイルが選択されていません');
      var bitmap = await createImageBitmap(file);
      var scale = Math.min(1, maxWidth / bitmap.width);
      var w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); // 透過 PNG は白背景にする
      ctx.drawImage(bitmap, 0, 0, w, h);
      var blob = null;
      for (var q of [0.88, 0.78, 0.68, 0.55]) {
        blob = await new Promise(function (r) { canvas.toBlob(r, 'image/jpeg', q); });
        if (blob && blob.size <= 900 * 1024) break;
        blob = null;
      }
      if (!blob) throw new Error('画像が大きすぎます。小さい画像を選んでください');
      var fd = new FormData();
      fd.append('file', new File([blob], 'image.jpg', { type: 'image/jpeg' }));
      var res = await fetch((window.APP_BASE || '') + '/api/media', { method: 'POST', headers: { 'X-CSRF-Token': Editor.csrf() }, body: fd });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'アップロードに失敗しました');
      return data;
    },

    // ---- ステップ配信の表示用 ----
    formatMinutes: function (m) {
      if (m <= 0) return 'すぐ';
      if (m % 1440 === 0) return (m / 1440) + '日';
      if (m >= 1440) {
        var h = Math.floor((m % 1440) / 60), r = m % 60;
        return Math.floor(m / 1440) + '日' + (h ? h + '時間' : '') + (r ? r + '分' : '');
      }
      if (m % 60 === 0) return (m / 60) + '時間';
      return m + '分';
    },
    cumulative: function (steps) {
      var total = 0;
      return steps.map(function (s) {
        total += s.delayMinutes;
        if (s.sendTime) { var d = Math.floor(total / 1440); return d === 0 ? '当日 ' + s.sendTime : d + '日後 ' + s.sendTime; }
        return total <= 0 ? 'すぐ' : '約' + Editor.formatMinutes(total) + '後';
      });
    }
  };
  window.Editor = Editor;

  document.addEventListener('alpine:init', function () {
    // 画像選択 → アップロード（エディタ内の各所で使う）
    Alpine.data('uploader', function () {
      return {
        busy: false, err: '',
        pick: function (ev, maxWidth, cb) {
          var input = ev.target, self = this;
          self.busy = true; self.err = '';
          Editor.upload(input.files[0], maxWidth).then(cb).catch(function (e) { self.err = e.message; }).finally(function () { self.busy = false; input.value = ''; });
        }
      };
    });

    // 一括配信の作成画面
    Alpine.data('composer', function (cfg) {
      return {
        channels: cfg.channels, tags: cfg.tags,
        channelIds: cfg.selected || [],
        tagNames: [],
        title: '',
        blocks: Editor.prep([Editor.newBlock('text')]),
        mode: 'now', scheduledLocal: '',
        busy: false, error: '',
        get totalFollowers() {
          var ids = this.channelIds;
          return this.channels.filter(function (c) { return ids.indexOf(c.id) >= 0; }).reduce(function (s, c) { return s + c.followers; }, 0);
        },
        has: function (id) { return this.channelIds.indexOf(id) >= 0; },
        toggleChannel: function (id) { this.channelIds = this.has(id) ? this.channelIds.filter(function (x) { return x !== id; }) : this.channelIds.concat([id]); },
        selectAll: function () { this.channelIds = this.channels.map(function (c) { return c.id; }); },
        clearAll: function () { this.channelIds = []; },
        toggleTag: function (n) { this.tagNames = this.tagNames.indexOf(n) >= 0 ? this.tagNames.filter(function (x) { return x !== n; }) : this.tagNames.concat([n]); },
        tagHave: function (t) { var ids = this.channelIds; return t.channelIds.filter(function (id) { return ids.indexOf(id) >= 0; }).length; },
        async submit(sendMode) {
          this.error = '';
          if (sendMode === 'now') {
            var names = this.channels.filter(function (c) { return this.has(c.id); }, this).map(function (c) { return c.name; }).join('、');
            var aud = this.tagNames.length ? 'タグ「' + this.tagNames.join('、') + '」の人' : '友だち全員';
            if (!confirm(this.channelIds.length + ' アカウント（' + names + '）の' + aud + 'に、いま配信します。よろしいですか？')) return;
          }
          var scheduledAt = null;
          if (sendMode === 'schedule') {
            if (!this.scheduledLocal) { this.error = '配信日時を指定してください'; return; }
            scheduledAt = new Date(this.scheduledLocal).toISOString(); // ブラウザ（日本時間）で解釈してから送る
          }
          this.busy = true;
          var r = await Editor.post('/api/campaigns', {
            title: this.title, blocks: Editor.clean(this.blocks), channelIds: this.channelIds,
            tagNames: this.tagNames, mode: sendMode, scheduledAt: scheduledAt
          });
          if (r.ok) { location.href = (window.APP_BASE || '') + '/campaigns/' + r.data.campaignId; return; }
          this.error = r.data.error || '失敗しました';
          this.busy = false;
        }
      };
    });

    // ステップ配信の作成・編集画面
    Alpine.data('scenarioForm', function (cfg) {
      var UNIT_MIN = { minute: 1, hour: 60, day: 1440 };
      function toState(s) {
        if (s.sendTime) return { _k: Editor.key(), mode: 'time', value: 0, unit: 'minute', days: Math.floor(s.delayMinutes / 1440), time: s.sendTime, blocks: Editor.prep(s.blocks) };
        var unit = s.delayMinutes > 0 && s.delayMinutes % 1440 === 0 ? 'day' : (s.delayMinutes > 0 && s.delayMinutes % 60 === 0 ? 'hour' : 'minute');
        return { _k: Editor.key(), mode: 'elapsed', value: s.delayMinutes / UNIT_MIN[unit], unit: unit, days: 1, time: '10:00', blocks: Editor.prep(s.blocks) };
      }
      function blank(first) {
        return first
          ? { _k: Editor.key(), mode: 'elapsed', value: 0, unit: 'minute', days: 0, time: '10:00', blocks: Editor.prep([Editor.newBlock('text')]) }
          : { _k: Editor.key(), mode: 'time', value: 0, unit: 'minute', days: 1, time: '10:00', blocks: Editor.prep([Editor.newBlock('text')]) };
      }
      var SAMPLE = [
        { delayMinutes: 0, sendTime: null, blocks: [{ type: 'text', text: '友だち追加ありがとうございます！\n施術のご案内やお得な情報をお届けします。' }] },
        { delayMinutes: 1440, sendTime: '10:00', blocks: [{ type: 'text', text: '先日はご来院ありがとうございました。\nその後、お身体の調子はいかがでしょうか？' }] },
        { delayMinutes: 6 * 1440, sendTime: '10:00', blocks: [{ type: 'text', text: 'お身体のメンテナンスは続けることが大切です。\n次回のご予約はお気軽にどうぞ。' }] }
      ];
      var init = cfg.initial;
      return {
        channelId: cfg.channelId, scenarioId: cfg.scenarioId, tags: cfg.tags, isEdit: !!cfg.scenarioId,
        name: init ? init.name : '', description: init ? (init.description || '') : '',
        triggerType: init ? init.triggerType : 'follow', triggerTagId: init && init.triggerTagId ? String(init.triggerTagId) : '',
        isActive: init ? init.isActive : true,
        steps: init ? init.steps.map(toState) : [blank(true)],
        busy: false, error: '',
        get triggerWord() { return this.triggerType === 'follow' ? '友だち追加' : 'タグ付与'; },
        payload: function () {
          return this.steps.map(function (s) {
            return s.mode === 'time'
              ? { delayMinutes: Math.max(0, Math.floor(s.days || 0)) * 1440, sendTime: s.time || null, blocks: Editor.clean(s.blocks) }
              : { delayMinutes: Math.max(0, Math.floor(s.value || 0)) * UNIT_MIN[s.unit], sendTime: null, blocks: Editor.clean(s.blocks) };
          });
        },
        get cumulative() { return Editor.cumulative(this.payload()); },
        addStep: function () { if (this.steps.length < 30) this.steps.push(blank(false)); },
        loadSample: function () {
          this.name = '初回来院フォロー'; this.description = '友だち追加の直後・翌日・1週間後にメッセージを送る';
          this.triggerType = 'follow'; this.steps = SAMPLE.map(function (s) { return toState(JSON.parse(JSON.stringify(s))); });
        },
        async save() {
          this.error = ''; this.busy = true;
          var path = '/api/c/' + this.channelId + '/scenarios' + (this.scenarioId ? '/' + this.scenarioId : '');
          var r = await Editor.post(path, {
            name: this.name, description: this.description || null, triggerType: this.triggerType,
            triggerTagId: this.triggerType === 'tag_added' ? (this.triggerTagId || null) : null,
            isActive: this.isActive, steps: this.payload()
          });
          if (r.ok) { location.href = (window.APP_BASE || '') + '/c/' + this.channelId + '/scenarios'; return; }
          this.error = r.data.error || '保存に失敗しました';
          this.busy = false;
        }
      };
    });

    // ステップ配信一覧の「他の店舗へコピー」
    Alpine.data('scenarioRow', function (cfg) {
      return {
        channelId: cfg.channelId, id: cfg.id, isActive: cfg.isActive, open: false, targets: [], msg: '', busy: false,
        async call(action, data) {
          this.busy = true; this.msg = '';
          var r = await Editor.post('/api/c/' + this.channelId + '/scenarios/' + this.id + '/' + action, data || {});
          this.busy = false;
          if (!r.ok) { this.msg = r.data.error || '失敗しました'; return null; }
          return r.data;
        },
        async toggle() { if (await this.call('toggle', { isActive: !this.isActive })) location.reload(); },
        async remove() { if (confirm('このシナリオを削除します（進行中の配信も止まります）。よろしいですか？') && await this.call('delete')) location.reload(); },
        async copy() {
          if (await this.call('copy', { channelIds: this.targets })) { this.open = false; this.targets = []; this.msg = 'コピーしました（コピー先は無効状態です）'; }
        }
      };
    });
  });
})();
