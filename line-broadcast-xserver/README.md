# 接骨院 LINE 一括配信（Xserver 版）

複数の LINE 公式アカウント（店舗）を 1 つの画面から管理し、**まとめて配信**するシステムです。
**Xserver のレンタルサーバー（PHP + MySQL）にそのまま設置できる**よう、PHP で作られています（Node.js・SSH・Composer は不要）。

> 同じ機能の Next.js 版（`../line-broadcast`、Vercel 向け）もあります。Xserver ではこのフォルダを使います。

## できること

- **全店舗 一括配信**：配信するアカウントを選択 → 日時（すぐ／予約／下書き）→ オーディエンス（全員／タグ）→ メッセージ作成
  - メッセージ（最大 5 吹き出し）：**テキスト／画像／リッチメッセージ**（1〜6 分割のタップ領域）**／カードタイプ**（画像・タイトル・説明・ボタン、最大 10 枚）
  - LINE 風プレビュー、アカウント別の送信結果、未送信分の「いますぐ配信」「取り消し」
- **ステップ配信**：友だち追加・タグ付与をきっかけに、メッセージを自動で順番に配信
  - 「前のステップから 3 時間後」「翌日の 10:00」などタイミングを指定、進行状況の確認、他店舗へコピー、サンプル入り
- 友だち管理（Webhook で自動同期・検索・メモ）、タグ管理、アカウント別の配信履歴
- **URLを知っている人だけが使える**（アクセスキー付き URL）・検索エンジンに載らない（noindex）
- 管理者／オペレーター権限（店舗スタッフは担当アカウントだけ操作可能）

## 導入する

1. [Xserver導入手順書](docs/Xserver導入手順書.md)（アップロード → データベース → インストーラー → cron）
2. [LINE公式アカウント接続手順書](docs/アカウント接続手順書.md)（アクセストークン・Webhook の設定）

詳しい仕組みは [設計書](docs/設計書.md) を参照してください。

## フォルダ構成

```
app/                  アプリ本体（Web から見えない場所に置く）
  bootstrap.php         起動処理
  config.sample.php     設定ファイルの見本（install.php が config.php を自動作成）
  schema.sql            データベース定義
  cron.php              定期実行（Xserver の Cron 設定から 1 分ごとに実行）
  src/                  ロジック（DB・認証・LINE API・配信・ステップ配信）
  routes/               URL ごとの処理
  views/                画面テンプレート
  storage/              配信用画像・ログ（書き込み可にする）
public/               Web に公開するフォルダの中身
  index.php             すべてのリクエストの入口
  install.php           初期セットアップ（完了後に自動削除）
  .htaccess             URL の書き換え設定
  assets/               CSS・JavaScript（Alpine.js 同梱。外部 CDN 不要）
docs/                 手順書・設計書
tests/                テスト（開発者向け。サーバーへのアップロードは不要）
build/                CSS の再ビルド用（開発者向け。サーバーへのアップロードは不要）
```

## 開発者向け：テストの実行

PHP 8.1+、MySQL/MariaDB、（画面テストのみ）Node.js + Playwright が必要です。

```bash
bash tests/setup.sh                      # /tmp にコピーして LINE API のモックと一緒に起動
php tests/run.php                        # 結合テスト（インストーラー〜配信〜ステップ配信〜権限）
NODE_PATH=$(npm root -g) node tests/ui.js  # ブラウザ操作テスト（メッセージエディタなど）
```

LINE の API は `tests/mock_line.php`（簡易モック）に向けて検証します。実際の LINE には送信しません。
