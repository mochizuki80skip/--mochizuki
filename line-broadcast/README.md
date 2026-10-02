# 接骨院 LINE 一括配信

接骨院事業専用の、**複数の公式LINEアカウントをまとめて管理・配信するシステム**。
他のプロジェクト（`line-platform` など）とは独立しており、DB・認証・デプロイもこのフォルダ単体で完結する。

> **Xserver（レンタルサーバー）で使う場合は、PHP + MySQL 版の [`../line-broadcast-xserver`](../line-broadcast-xserver/README.md) を使用してください。** このフォルダは Next.js（Vercel など Node.js が動く環境）向けです。

## できること

### 全店舗 一括配信（`/dashboard/campaigns`）

1 回の作成で、選択した複数アカウントへまとめて配信する。

- **配信アカウント**：チェックボックスで店舗を選択（全選択／全解除）。ログインユーザーが権限を持つアカウントのみ表示
- **配信日時**：すぐ配信 ／ 日時指定（予約）／ 下書き保存
- **オーディエンス**：友だち全員 ／ タグ絞り込み。タグは各アカウントの**同名タグ**で突き合わせる
  （選んだタグが無いアカウントは「対象なし」でスキップ。全員に送られることはない）
- **メッセージ（最大 5 吹き出し）**：
  テキスト / 画像 / リッチメッセージ（タップ領域 1〜6 分割、リンク or テキスト送信）/ カードタイプ（画像・タイトル・説明・ボタン最大 3、最大 10 枚）
- LINE 風プレビュー、アカウント別の送信結果、未送信分の「いますぐ配信」「取り消し」

### アカウント単位の管理（`/dashboard/c/{アカウント}`）

- 友だち管理（Webhook で自動同期 / 検索 / メモ）、タグ管理と付け外し
- アカウント単独の一斉配信
- **ステップ配信**（友だち追加・タグ付与をきっかけに自動で順番に配信）：
  経過時間／「◯日後の10:00」でタイミング指定、テキスト・画像・リッチ・カードを設定、進行状況の確認、他店舗へコピー
- 管理ユーザーごとのアクセス権（`super_admin` は全アカウント、`operator` は割り当てたアカウントのみ）

## ドキュメント

- [設計書](docs/設計書.md)
- [LINE公式アカウント接続手順書](docs/アカウント接続手順書.md)（アクセストークン・Webhook の設定）

## 技術スタック

Next.js 15 (App Router) / TypeScript / PostgreSQL + Prisma / NextAuth / @line/bot-sdk / Tailwind CSS

## セットアップ

```bash
cd line-broadcast
npm install
cp .env.example .env   # DATABASE_URL, NEXTAUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD などを設定
npx prisma db push     # テーブル作成
npm run seed           # 管理者ユーザー作成
npm run dev            # http://localhost:3001
```

`.env` の `ADMIN_EMAIL` / `ADMIN_PASSWORD` でログインし、「LINE アカウント追加」から各店舗の
チャネルアクセストークン・チャネルシークレットを登録する（アカウントごとに Webhook URL が発行される）。

## LINE 側の設定

各アカウントの Webhook URL（アカウントの「設定」画面に表示）を、LINE Developers Console →
Messaging API 設定 → Webhook URL に設定して有効化する。友だち追加／ブロックがここ経由で同期され、
タグ配信の対象になる。ローカル開発では ngrok 等で公開する。

## 本番デプロイ（Vercel）

1. Vercel で New Project → このリポジトリを選択
2. **Root Directory** を `line-broadcast` に設定（Framework: Next.js、Build: `npm run build`）
3. 環境変数：`DATABASE_URL`（Neon / Supabase など）、`NEXTAUTH_SECRET`、`NEXTAUTH_URL`（本番ドメイン）、
   `ADMIN_EMAIL`、`ADMIN_PASSWORD`、`CRON_SECRET`
4. デプロイ（ビルド時に `prisma db push` と管理者 seed が走る）

`NEXTAUTH_URL`（または `APP_BASE_URL`）は、配信画像の公開URLの起点として使われる。LINE が画像を取得するため、
**必ず公開ドメインを設定する**こと。

### 予約配信・ステップ配信の実行（cron）

Vercel Hobby の Cron は 1 日 1 回までなので、外部 cron サービス（例：cron-job.org）で
`GET https://{ドメイン}/api/cron/dispatch` を **1 分間隔**で叩く。
ヘッダに `Authorization: Bearer {CRON_SECRET}` を付ける。

## 注意

- LINE の月間メッセージ配信数の上限は**アカウントごと**に消費される。8 アカウントへ一括配信すると、各アカウントの友だち数ぶん消費する。
- アップロード画像は DB（`Media` テーブル）に保存し `/api/media/{id}` で公開する（推測困難なIDのみで保護）。
