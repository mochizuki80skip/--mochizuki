# 接骨院 投稿管理（GBP / Instagram 一括投稿）

接骨院の全店舗の Google ビジネスプロフィール（GBP）と Instagram に、
**AI が店舗ごとの投稿文を作成 → 本部がまとめて確認・承認 → 予定日時に自動投稿**する管理画面です。

## できること

| 機能 | 内容 |
|---|---|
| 店舗の取り込み | 連携した Google アカウントが管理する全店舗から、接骨院だけを選んで登録（店舗名・カテゴリで接骨院らしい店舗に自動でチェック）。**登録した店舗以外（鍼灸院・ジムなど）には投稿しない** |
| 翌週分の一括作成 | 設定した曜日（初期値：月・水・金・土）×全店舗の投稿枠を作成。テーマは 8 種類を順番に回す |
| AI 作成 | 店舗の地域・特徴・季節の話題を入れて、店舗ごとに言い回しを変えた GBP 文と Instagram キャプション（ハッシュタグ付き）を作成 |
| 表現チェック | 「治る」「必ず」「No.1」「体験談」「ビフォーアフター」、GBP 本文中の電話番号、独自 NG ワードなど。**要修正がある投稿は承認できない** |
| 本部の確認・承認 | 1 画面に全店舗分を表示。編集・作り直し・見送り、「問題なしをまとめて承認」 |
| 自動投稿 | 承認済みを予定日時に GBP / Instagram へ投稿。失敗した媒体だけ再送できる |
| 実績 | 全店舗の表示回数・電話タップ・ルート検索・ウェブサイトクリックを、前の 28 日間と比較して一覧表示 |

## 週の運用イメージ

1. 週 1 回「翌週分を作成」を押す
2. 各回を開いて「AI で作成」→ 全店舗分の文章ができる
3. 赤枠（要修正）だけ直して、「問題なしをまとめて承認」
4. あとは予定日時に自動で投稿される。失敗は画面に赤く表示

キャンペーン・休診などは「個別に作成」で臨時の回を作れます（補足欄に内容を書くと AI が反映）。

---

## 導入手順

### 1. Google Cloud の準備（GBP API）

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. **GBP API の利用申請**を出す：[申請フォーム](https://support.google.com/business/contact/api_default) で「Application for Basic API Access」を選択
   - 用途：「自社で運営する接骨院の Google ビジネスプロフィールへの投稿と実績の集計」
   - プロジェクト番号、GBP を管理しているメールアドレス、会社のウェブサイトが必要
   - 承認まで数日〜数週間。承認前は API の利用枠が 0 のため投稿・取り込みはできない
3. 承認後、「API とサービス > ライブラリ」で次を有効化
   - My Business Account Management API
   - My Business Business Information API
   - Google My Business API（投稿に使用）
   - Business Profile Performance API（実績に使用）
4. 「OAuth 同意画面」を作成（ユーザーの種類は組織に合わせて選択）
5. 「認証情報 > OAuth クライアント ID」を作成（種類：ウェブアプリケーション）
   - 承認済みのリダイレクト URI：`https://（本番のドメイン）/api/google/callback`
   - 発行されたクライアント ID / シークレットを環境変数に設定

### 2. Instagram の準備（使う店舗のみ）

1. 各店舗の Instagram を**プロアカウント（ビジネス）**に切り替え
2. [Meta for Developers](https://developers.facebook.com/) でアプリを作成し、「Instagram API（Instagram ログイン）」を追加
3. 各店舗の Instagram アカウントをアプリに追加して**長期アクセストークン**と**ユーザー ID** を発行
4. 管理画面の「店舗 > 編集」で、ユーザー ID とトークンを登録して「Instagram に投稿する」をオン
   - トークンは暗号化して保存され、期限（60 日）の 10 日前に自動で延長される
   - Instagram は画像が必須。店舗編集の「投稿用写真の URL」に写真を登録しておくと順番に使われる（画像はインターネット上で公開された URL が必要）

### 3. デプロイ（Vercel）

1. Vercel で New Project → このリポジトリ → **Root Directory を `post-platform`** に設定
2. PostgreSQL（Neon / Supabase など）を用意
3. 環境変数を設定（`.env.example` 参照）
   - `DATABASE_URL` / `NEXTAUTH_SECRET` / `NEXTAUTH_URL` / `ADMIN_EMAIL` / `ADMIN_PASSWORD`
   - `ENCRYPTION_KEY`（`openssl rand -base64 32`。**後から変えると保存済みトークンが読めなくなる**）
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
   - `GEMINI_API_KEY`（[Google AI Studio](https://aistudio.google.com/apikey) で取得）
   - `CRON_SECRET`
4. デプロイ（ビルド時に DB のテーブル作成と管理者ユーザーの作成を自動で行う）
5. **自動投稿の Cron**：[cron-job.org](https://cron-job.org) などで `https://（ドメイン）/api/cron/dispatch` を **5〜10 分おき**に GET
   - ヘッダー：`Authorization: Bearer （CRON_SECRET の値）`

### 4. 初期設定（管理画面）

1. `ADMIN_EMAIL` / `ADMIN_PASSWORD` でログイン
2. 設定 → **Google アカウントを連携する**（GBP の管理者権限を持つアカウントで）
3. 店舗 → **Google から取り込む** → 接骨院だけにチェックが入っているか確認して取り込み
4. 各店舗を編集：地域（駅名など）・特徴・予約ページ URL・写真を入力（AI の文章の質が上がる）
5. 設定 → 投稿曜日・時刻・共通ハッシュタグ・独自 NG ワード
6. 最初は 1〜2 店舗だけ「投稿対象にする」にして試し、問題なければ全店舗に広げるのがおすすめ

## 開発

```bash
cd post-platform
npm install
cp .env.example .env   # 値を設定
npx prisma db push
npm run seed
npm run dev            # http://localhost:3002
```

## 注意

- 表現チェックは簡易的なもの。最終的な判断は本部で行ってください
- Google / Meta の API 仕様は変更されることがあるため、エラーが続く場合は API のバージョン・権限を確認してください
