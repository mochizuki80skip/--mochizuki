# 接骨院 投稿管理（GBP / Instagram 一括投稿・分析）

接骨院の全店舗の Google ビジネスプロフィール（GBP）と Instagram の投稿を、
**文章・画像・リール動画の作成 → 本部がまとめて確認・承認 → 予定日時に自動投稿 → 実績の分析と改善提案**
まで 1 つの管理画面で行います。

## できること

| 機能 | 内容 |
|---|---|
| 店舗の取り込み | 連携した Google アカウントが管理する全店舗から、接骨院だけを選んで登録。**登録した店舗以外（鍼灸院・ジムなど）には投稿しない** |
| 店舗リスト（差し込み） | 院名・地名・エリア・特徴・予約 URL＋自由な列（駐車場、院長名など）を一覧で編集。**CSV で Excel と行き来できる**（Shift_JIS の CSV も取り込み可） |
| テンプレート投稿 | 「【{エリア}】{地名}の{院名}です…」のように書くと、店舗リストの値を差し込んで全店舗分を一瞬で作成。空欄の店舗は「要修正」になり承認できない |
| AI 投稿 | 店舗の地域・特徴・季節の話題から、店舗ごとに言い回しを変えた文章を AI が作成 |
| 画像・リール動画 | AI で背景画像を作成（またはアップロード）→ 見出しと店舗ごとの院名・エリアの帯を入れた投稿画像、または 12 秒の縦型リール動画（見出し → 本文の要点 → 院名と予約案内）を全店舗分作成 |
| 表現チェック | 「治る」「必ず」「No.1」「体験談」「ビフォーアフター」、GBP 本文中の電話番号、独自 NG ワードなど。**要修正がある投稿は承認できない** |
| 本部の確認・承認 | 1 画面に全店舗分。編集・作り直し・見送り、「問題なしをまとめて承認」 |
| 自動投稿 | 承認済みを予定日時に GBP（画像つき）/ Instagram（画像 or リール）へ投稿。失敗した媒体だけ再送できる |
| 実績・分析 | GBP（表示回数・電話・ルート・サイト・検索キーワード）と Instagram（リーチ・反応・フォロワー・投稿別の保存/シェア）を前の 28 日と比較。**AI が改善提案と次のテーマ案を出し、テーマ案から投稿を作れる**。毎週月曜に自動作成 |
| ログイン情報 | 店舗の Instagram 等の ID・パスワードを暗号化して保管。表示には本部パスワードの再入力が必要で、表示・更新の記録が残る |

### ログイン情報の扱いについて
- 自動投稿は ID・パスワードではなく **Instagram のアクセストークン**で行います。ID・パスワードでの自動ログインは Instagram の規約違反となり、アカウントロックの原因になるため行いません。
- 保管機能はスタッフの引き継ぎ・管理用です。Instagram 側では 2 段階認証を有効にしてください。

## 週の運用イメージ

1. 「翌週分を作成」（設定した曜日×全店舗の枠ができる。初期値は月・水・金・土）
2. 各回を開いて文章を作成（AI または テンプレート）→ 画像・リールを作成
3. 赤枠（要修正）だけ直して「問題なしをまとめて承認」
4. 予定日時に自動投稿。月曜に分析レポートが届くので、テーマ案を次の週に反映

院名・地名だけ変えて同じ内容を出す場合は「個別に作成」でテンプレートを選びます。

---

## XServer VPS へのデプロイ

> **エックスサーバーの「レンタルサーバー」では動きません**（Node.js の常駐・PostgreSQL・動画生成に必要な ffmpeg が使えないため）。
> **XServer VPS**（メモリ 2GB 以上推奨）を契約し、OS は Ubuntu を選んでください。

### 1. サーバーの準備
1. XServer VPS を申し込み（Ubuntu）。パケットフィルターで **22（SSH）・80・443** を許可
2. ドメインの DNS で、使うサブドメイン（例：`post.example.com`）の A レコードを VPS の IP アドレスに向ける
3. SSH でログインし、Docker をインストール
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```

### 2. アプリの配置と起動
```bash
git clone （このリポジトリ） app && cd app/post-platform
cp .env.example .env
nano .env        # 下の「環境変数」を設定
docker compose up -d --build
```
- 初回起動時にデータベースのテーブルと管理者ユーザーが自動で作られます
- HTTPS 証明書は Caddy が自動で取得・更新します
- 予約投稿の送信（5 分おき）と週次分析（月曜 8 時）は `cron` コンテナが自動で行います
- 更新時：`git pull && docker compose up -d --build`
- バックアップ：`docker compose exec db pg_dump -U app post_platform > backup.sql`（画像・動画は `media` ボリューム）

### 3. 環境変数（`.env`）
| 変数 | 内容 |
|---|---|
| `DOMAIN` | このシステムのドメイン（例：`post.example.com`） |
| `DB_PASSWORD` | データベースのパスワード（`openssl rand -hex 16`） |
| `NEXTAUTH_SECRET` | ログイン用の秘密鍵（`openssl rand -base64 32`） |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | 本部の管理画面ログイン |
| `ENCRYPTION_KEY` | トークン・パスワードの暗号化キー（`openssl rand -base64 32`）。**変えると保存済みの情報が読めなくなるので必ず控える** |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | 下の「Google の準備」で発行 |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) で発行（文章・背景画像・分析に使用） |
| `CRON_SECRET` | 自動実行用の合言葉（`openssl rand -hex 16`） |

## Google の準備（GBP API）

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. **GBP API の利用申請**：[申請フォーム](https://support.google.com/business/contact/api_default) で「Application for Basic API Access」
   - 用途：「自社で運営する接骨院の Google ビジネスプロフィールへの投稿と実績の集計」
   - 承認まで数日〜数週間。承認前は店舗の取り込み・投稿・実績取得ができません
3. 承認後、「API とサービス > ライブラリ」で次を有効化
   - My Business Account Management API / My Business Business Information API
   - Google My Business API（投稿）/ Business Profile Performance API（実績・検索キーワード）
4. 「OAuth 同意画面」を作成し、「認証情報 > OAuth クライアント ID（ウェブアプリケーション）」を作成
   - 承認済みのリダイレクト URI：`https://（DOMAIN）/api/google/callback`

## Instagram の準備（使う店舗のみ）

1. 各店舗の Instagram を**プロアカウント（ビジネス）**に切り替え
2. [Meta for Developers](https://developers.facebook.com/) でアプリを作成し「Instagram API（Instagram ログイン）」を追加
   - 権限：`instagram_business_basic`、`instagram_business_content_publish`、`instagram_business_manage_insights`
3. 各店舗のアカウントの**長期アクセストークン**と**ユーザー ID** を発行し、「店舗 > 編集」で登録
   - トークンは暗号化して保存し、期限（60 日）の 10 日前に自動延長します
4. Instagram は画像または動画が必須です。店舗の写真を登録するか、回ごとに画像・リールを作成してください

## 初期設定（管理画面）

1. `ADMIN_EMAIL` / `ADMIN_PASSWORD` でログイン
2. 設定 → **Google アカウントを連携**（GBP の管理者権限を持つアカウント）、投稿曜日・時刻・帯の色・ハッシュタグ・NG ワード
3. 店舗 → **Google から取り込む**（接骨院だけにチェックが入っているか確認）
4. 店舗リスト → 地名・エリア・特徴・予約 URL を入力（CSV で Excel から一括入力も可）
5. 最初は 1〜2 店舗だけ「投稿対象にする」にして試し、問題なければ全店舗に広げる

## 開発

```bash
cd post-platform
npm install
cp .env.example .env   # DATABASE_URL などローカル用の値を設定
npx prisma db push && npm run seed
npm run dev            # http://localhost:3002（動画作成には ffmpeg が必要）
npm test
```

## 注意

- 表現チェック・AI の提案は目安です。最終的な判断は本部で行ってください
- AI で作った背景画像は「実際の院内・施術の写真」と誤解されない使い方にしてください（院内や施術の紹介には実際の写真を推奨）
- Google / Meta の API は仕様や指標が変わることがあります。取得できない指標は自動で飛ばしますが、エラーが続く場合は API のバージョン・権限を確認してください
