# リカバリー鍼灸院 空き状況サイト

threease の予約システム（`reservation.threease.com/192` / `/193`）をリアルタイムで参照し、見やすいウィザード式 UI で空き状況を表示。気になる枠をタップして公式LINEへ誘導する。

## 予約フロー

1. **院選択**（タブ）長泉三島院 / 裾野長泉院
2. **STEP 1: 来院パターン** 初回 / 2回目以降
3. **STEP 2: コース選択** API から取得した実コース一覧から選ぶ
4. **STEP 3: 日時選択** 選んだコースが取れる時間のみカレンダーで表示
5. **STEP 4: LINE で予約** 予約用テキストを自動生成 → コピー → 公式LINEへ遷移

## 構成

```
reserve/
├── index.html        ウィザード形式フロント
├── app.js            ステップ管理・データ取得・描画
├── style.css         ロゴ配色（黒・ゴールド・温かいオフホワイト）
├── api/
│   └── availability.js   Vercel Serverless（threease APIプロキシ＋集約）
├── vercel.json
└── package.json
```

データの流れ：

```
ブラウザ
  ↓ /api/availability?clinic=192&start=...&end=...&for_new=true
Vercel Serverless
  ├── /calendar?...                      （週次の全空き時間を取得）
  ├── /courses?for_new_customers=Y       （来院区分別のコース一覧）
  └── /courses?start_time=T&for_new=Y    （各時間枠ごとに並列実行）
threease API
```

CORS の制約上ブラウザから threease を直接呼べないため、サーバー関数で中継し、3 分間 Edge キャッシュする。クライアントは「時間 → 取れるコースID 一覧」のマップを使い、選んだコースで時間枠を絞り込む。

## 院別の公式LINE / 電話 / threease URL

`app.js` 先頭の `CLINICS` 定数に登録済み。

```js
const CLINICS = {
  '192': {
    name: '...', short: '長泉三島院',
    lineUrl: 'https://lin.ee/s6l4Yso',
    phone: '055-000-0000',
    threeaseUrl: 'https://reservation.threease.com/192',
  },
  '193': { ... },
};
```

## チラシ限定メニュー（管理画面）

`/admin` で限定メニューを登録できる。一般のお客様には URL に `?promo=コード` が付かない限り表示されない。

### セットアップ（初回のみ）

1. **Upstash Redis を接続**（KV 相当のストレージ）
   - Vercel ダッシュボード → このプロジェクト → **Storage** タブ
   - **Marketplace Database Providers** の中の **Upstash** をクリック
   - **Redis** を選択 → 「Create」
   - 自動で環境変数（`KV_REST_API_URL` / `KV_REST_API_TOKEN`、または `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`）が設定される
2. **管理パスワードを設定**
   - Vercel ダッシュボード → プロジェクト → Settings → Environment Variables
   - `ADMIN_PASSWORD` という名前で好きなパスワードを追加（Production / Preview / Development 全てチェック）
   - 「Save」で再デプロイされる
3. `/admin` にアクセスして上記パスワードでログイン

### 運用

- `/admin` にアクセス → ログイン
- 「新規キャンペーン追加」フォームで URL コード・メニュー名・価格などを入力
- 保存すると一覧に追加され、対応する公開URL（`?promo=...`）が表示される
- そのURLをコピーして QR コード生成サイトに渡す → チラシに印刷
- 同じ URL コードを再入力すると上書き編集
- 削除ボタンで削除

## 配色（ロゴ準拠）

- 背景: `#faf7f0`（温かいクリーム）
- メイン: `#1a1a1a`（黒、ハリネズミの体）
- アクセント: `#bfa572` / `#9c8753`（ロゴのベージュ／ゴールド）
- LINE ボタン: `#06c755`（LINE 公式緑、視認性のためそのまま）

## ロゴ画像

`reserve/logo.png`（または .svg）に配置すると、ヘッダー左に 44px で表示される。
ファイルが無い場合は自動的に非表示になる（`onerror` で `display:none`）。

## デプロイ手順（Vercel）

1. Vercel にログイン → "Add New" → "Project"
2. リポジトリ `mochizuki80skip/--mochizuki` をインポート
3. **Root Directory** を `reserve` に設定（重要）
4. Framework Preset: "Other"
5. Build / Output 設定はデフォルト（空欄で可）
6. "Deploy"

デプロイ後、`https://<project-name>.vercel.app/` でアクセス可能。

## ローカル動作確認

```bash
cd reserve
npx vercel dev
```

`http://localhost:3000` でフロントとサーバー関数が同時に動作する。

## API 仕様メモ（threease 側）

- ベース: `https://api.threease.com/api/v1/home/providers/{providerId}`
- 認証: なし（公開API）
- CORS: `Access-Control-Allow-Origin: https://reservation.threease.com` のみ
- 院ID: `192` = 長泉三島院 / `193` = 裾野長泉院

利用エンドポイント：

```
GET /calendar?start_date=YYYYMMDD&end_date=YYYYMMDD
→ { calendar: { available_slots: [{ date, available_times: [ISO,...] }, ...] } }

GET /courses?per=100&page=1&home=false&for_new_customers=Y
   [&start_time=ISO]
→ { courses: [{ id, product_name, description, duration, price }, ...] }
```

## 運用上の注意

- 表示は数分のキャッシュあり。予約直後に枠が消えていない瞬間がありえる。
- 実際の予約確定は LINE 受付時に最終確認する旨を画面下部に注記。
- threease 側の API 仕様変更時は `api/availability.js` を要修正。
- 1リクエストにつき threease への呼び出しは「カレンダー1回 + コース一覧1回 + 時間枠数N回」。Edge キャッシュで実 API 負荷は1院×1週で 3 分に 1 回程度に抑えられる。
