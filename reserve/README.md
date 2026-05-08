# リカバリー鍼灸院 空き状況サイト

threease の予約システム（`reservation.threease.com/192` / `/193`）の空き状況をリアルタイムで取得し、見やすいカレンダーUIで表示。気になる枠をタップすると、予約用テキストをクリップボードにコピーした上で公式LINEのトーク画面を開く。

## 構成

```
reserve/
├── index.html        フロント
├── app.js            フロントロジック
├── style.css         スタイル
├── api/
│   └── availability.js   Vercel Serverless Function（threease APIプロキシ + 3分キャッシュ）
├── vercel.json
└── package.json
```

データの流れ：

```
ブラウザ
  ↓ /api/availability?clinic=192&start=YYYYMMDD&end=YYYYMMDD
Vercel Serverless
  ↓ https://api.threease.com/api/v1/home/providers/{id}/calendar?...
threease API
```

CORS 制約のため、ブラウザから threease API を直接呼ぶことはできない。サーバー関数で中継し、Vercel Edge で 3 分キャッシュする。

## 公開前に必ず差し替える値

`app.js` 先頭の `LINE_URL` を、リカバリー鍼灸院の公式 LINE URL に変更する。

```js
const LINE_URL = 'https://lin.ee/REPLACE_ME';  // ← ここ
```

`https://lin.ee/xxxxxx` 形式が最もシンプルで端末互換性が高い。`https://line.me/R/ti/p/@xxxxxx` 形式でも可。

## デプロイ手順（Vercel）

1. Vercel にログイン → "Add New" → "Project"
2. このリポジトリ（`mochizuki80skip/--mochizuki`）をインポート
3. **Root Directory** を `reserve` に設定（重要）
4. Framework Preset: "Other"
5. Build / Output 設定はデフォルト（空欄で可）
6. "Deploy"

デプロイ後、`https://<project-name>.vercel.app/` でアクセス可能。
独自ドメインは Vercel の Domains 設定から追加する。

## ローカル動作確認

```bash
cd reserve
npx vercel dev
```

`http://localhost:3000` で動作確認できる（`/api/availability` も同時に動く）。

## API 仕様メモ（threease 側）

- ベース: `https://api.threease.com/api/v1/home/providers/{providerId}`
- 認証: なし（公開API）
- CORS: `Access-Control-Allow-Origin: https://reservation.threease.com` のみ → ブラウザ直叩き不可
- 院ID: `192` = 長泉三島院 / `193` = 裾野長泉院

利用エンドポイント：

```
GET /calendar?start_date=YYYYMMDD&end_date=YYYYMMDD
→ {
    calendar: {
      start_date, end_date,
      available_slots: [
        { date: "YYYY-MM-DD", available_times: ["YYYY-MM-DDTHH:MM:00+09:00", ...] },
        ...
      ]
    }
  }
```

## 運用上の注意

- 表示は当院 threease の生データ。実際の予約確定は LINE 受付時に最終確認する旨を画面下部に注記している。
- 数分のキャッシュがあるため、予約直後に枠が消えていない瞬間があり得る（運用上問題ない範囲）。
- threease 側の API 仕様が変わった場合は `api/availability.js` を要修正。
