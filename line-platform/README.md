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

## 本番デプロイ

デプロイ上限解除後に：

1. Vercel に Next.js をデプロイ
2. PostgreSQL は Neon / Supabase / Railway など
3. ワーカーは Vercel Cron か別ホスト（Railway / Fly / VPS）で `npm run worker`
4. `LINE_CHANNEL_*` を環境変数に設定
5. LINE Developers の Webhook URL を本番ドメインに変更

## Phase 2 候補（未実装）

- リッチメニュー出し分け
- LIFF フォーム / 予約 / 決済
- 流入経路分析（パラメータ付き友だち追加URL）
- 個別チャット返信（Reply API）
- 画像 / カルーセル / Flex Message のエディタ
- AI 自動応答
