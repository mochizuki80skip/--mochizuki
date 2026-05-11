# LINE Platform

Lステップ風の公式LINE運用プラットフォーム（自社運用向け / シングルアカウント）。

## 機能（Phase 1）

- 友だち管理（自動同期 / 検索 / メモ / カスタム属性 JSON）
- タグ機能（カラー / 一覧 / 友だちへ付け外し）
- 一斉配信（全員 / タグ絞り / 予約）
- ステップ配信（友だち追加トリガー / タグ付与トリガー / 任意分後ディレイ）
- 受信メッセージ履歴
- 管理者ログイン（メール + パスワード）

## 技術スタック

- Next.js 15 (App Router) / TypeScript
- PostgreSQL + Prisma
- NextAuth (Credentials)
- @line/bot-sdk
- Tailwind CSS
- 配信ワーカー: 単独 Node プロセス（30 秒間隔）

## セットアップ

### 1. 依存インストール

```bash
cd line-platform
npm install
```

### 2. 環境変数

`.env.example` をコピーして `.env` を作成し、以下を設定：

```bash
LINE_CHANNEL_ACCESS_TOKEN=...
LINE_CHANNEL_SECRET=...
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/line_platform
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=http://localhost:3001
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=好きなパスワード
```

### 3. DB 初期化

```bash
npm run prisma:migrate -- --name init
npm run seed
```

### 4. 起動

```bash
# ターミナル A
npm run dev          # http://localhost:3001

# ターミナル B（配信ワーカー）
npm run worker
```

ブラウザで `http://localhost:3001` を開き、`.env` の `ADMIN_EMAIL` / `ADMIN_PASSWORD` でログイン。

## LINE Webhook の設定

LINE はインターネット越しに到達できる URL でないと Webhook を呼べない。デプロイ前は ngrok で代用：

```bash
# 別ターミナルで
ngrok http 3001
# → https://xxxxx.ngrok-free.app/api/line/webhook を
# LINE Developers Console > Messaging API > Webhook URL に設定
```

ローカルで署名検証をスキップしたい場合は `.env` に `SKIP_LINE_SIGNATURE=true` を入れる（**本番では絶対に外す**）。

## ディレクトリ構成

```
src/
  app/
    api/
      line/webhook/        ← LINE 受信エンドポイント
      auth/[...nextauth]/  ← 管理者ログイン
      friends/             ← 友だち API
      tags/                ← タグ API
      broadcasts/          ← 一斉配信 API
      scenarios/           ← シナリオ API
    dashboard/             ← 管理画面
    login/
  lib/
    line.ts                ← LINE クライアント
    signature.ts           ← Webhook 署名検証
    scenario.ts            ← シナリオ実行ロジック
    broadcast.ts           ← 一斉配信ロジック
    auth.ts                ← NextAuth 設定
    prisma.ts
  worker/index.ts          ← 配信ワーカー（30 秒間隔）
prisma/schema.prisma
```

## 本番デプロイ（Vercel）

このリポジトリは複数プロジェクトを含むため、Vercel 側で **Root Directory** を `line-platform` に設定する必要がある。

### 手順

1. Vercel で New Project → このリポジトリを選択
2. Configure Project：
   - **Root Directory**: `line-platform`
   - **Framework Preset**: Next.js（自動検出）
   - **Build Command**: `npm run build`（package.json で `prisma generate && next build`）
   - **Install Command**: `npm install`
3. Environment Variables を設定：
   ```
   LINE_CHANNEL_ACCESS_TOKEN=（実値）
   LINE_CHANNEL_SECRET=（実値）
   DATABASE_URL=postgres://...（Neon / Supabase / Railway など）
   NEXTAUTH_SECRET=（openssl rand -base64 32）
   NEXTAUTH_URL=https://your-domain.vercel.app
   ADMIN_EMAIL=you@example.com
   ADMIN_PASSWORD=好きなパスワード
   ```
4. Deploy
5. デプロイ完了後、ローカルから初回マイグレーション＆シード：
   ```bash
   DATABASE_URL='本番のURL' npx prisma migrate deploy
   DATABASE_URL='本番のURL' ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run seed
   ```
6. LINE Developers Console → Messaging API → **Webhook URL** を `https://your-domain.vercel.app/api/line/webhook` に設定し、検証 → 有効化

### ワーカーのデプロイ

Vercel Functions は短命プロセスなので `npm run worker` の常駐は不可。以下から選択：

| 方式 | おすすめ用途 |
|---|---|
| **Vercel Cron**（推奨） | `/api/cron/dispatch` を 1 分間隔で叩く。設定は下記。 |
| Railway / Fly.io / VPS | 厳密な 30 秒間隔が欲しい場合 |
| GitHub Actions schedule | 手軽だが 5 分粒度 |

**Vercel Cron を使う場合**（次フェーズで `/api/cron/dispatch` を実装予定）：
```json
// vercel.json
{ "crons": [{ "path": "/api/cron/dispatch", "schedule": "* * * * *" }] }
```

### DB（PostgreSQL）の用意

無料枠で十分始められる：
- **Neon**（推奨）: サーバレス PostgreSQL、無料枠 0.5GB
- **Supabase**: 無料枠 500MB
- **Railway**: 月 $5 から

## Phase 2 候補（未実装）

- リッチメニュー出し分け
- LIFF フォーム / 予約 / 決済
- 流入経路分析（パラメータ付き友だち追加URL）
- 個別チャット返信（Reply API）
- 画像 / カルーセル / Flex Message のエディタ
- AI 自動応答
