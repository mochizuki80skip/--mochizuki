# ONE'S MEAL v2

ONE'S BODY パーソナルジム × kaloko 風UI の食事・体組成管理プラットフォーム。
ユーザー向けPWA + LINE LIFFミニアプリ + トレーナー向け管理サイト統合。

## 機能

### ユーザー向け（PWA / LIFF）
- **ハイブリッド保存**: ゲストはローカル（IndexedDB）、LINEログインでサーバーDBへ
- **オンボーディング**: 性別/年齢/身長/体重/活動量/目標 → BMR/TDEE/PFC自動計算
- **食事記録**: 約180品目DB検索、写真AI解析（Claude Vision）、手入力、履歴ワンタップ追加
- **体重管理**: 7/30/90日グラフ、目標体重ライン、BMI、体脂肪率対応
- **AIアドバイス**: 今日 / 週次レポート（Claude Sonnet 4.6）
- **会員モード**: 会員コード入力で特別管理対象に
- **PWA**: オフライン、ホーム画面追加

### 管理サイト `/admin`
- **トレーナー認証**: LINEログイン + 環境変数許可リスト
- **ダッシュボード**: 会員数、一般ユーザー数、見込み客数、本日アクティブ
- **会員一覧**: 最終記録日、要フォロー判定、目標進捗
- **会員詳細**: 食事ログ閲覧、PFCリング、体重グラフ、30日カロリー推移、トレーナーコメント投稿
- **一般ユーザー一覧**: オンボード完了ユーザーの管理
- **見込み客リスト**: LINE連携したが未オンボードの「営業対象」
- **招待コード管理**: 発行・コピー・削除
- **トレーナー管理（owner専用）**: 許可リスト確認

## 技術スタック

- **Next.js 15** (App Router, Server Components)
- **TypeScript / React 19**
- **Tailwind CSS** (kaloko風オレンジ #FF5F3D アクセント、ライトテーマ)
- **Prisma + PostgreSQL** (Vercel Postgres / Supabase 等を想定)
- **LINE LIFF** (`@line/liff`)
- **LINE ID Token verification** (`api.line.me/oauth2/v2.1/verify`)
- **Anthropic Claude API** (Sonnet 4.6 + Vision)

## ディレクトリ構成

```
nutrition-app/
├── prisma/schema.prisma
├── public/
│   ├── manifest.json, icon.svg
├── src/
│   ├── app/
│   │   ├── layout.tsx, globals.css
│   │   ├── page.tsx, home-view.tsx           # ホーム
│   │   ├── onboarding/page.tsx               # オンボード
│   │   ├── log/page.tsx                      # 食事記録
│   │   ├── weight/page.tsx                   # 体重
│   │   ├── advice/page.tsx                   # AIアドバイス
│   │   ├── settings/page.tsx                 # 設定
│   │   ├── admin/
│   │   │   ├── layout.tsx, admin-shell.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── page.tsx                      # ダッシュボード
│   │   │   ├── members/page.tsx
│   │   │   ├── members/[id]/page.tsx, detail-view.tsx
│   │   │   ├── users/page.tsx
│   │   │   ├── leads/page.tsx
│   │   │   ├── codes/page.tsx, codes-view.tsx
│   │   │   └── trainers/page.tsx
│   │   └── api/
│   │       ├── auth/line/route.ts            # ユーザーログイン
│   │       ├── profile, meals, weights/      # ユーザーデータ
│   │       ├── advice, photo, sync/          # AI / ローカル同期
│   │       └── admin/
│   │           ├── auth/route.ts             # トレーナーログイン
│   │           ├── comments/, codes/         # 管理操作
│   ├── components/
│   │   ├── layout/AppShell, BottomNav
│   │   └── ui/Toast, Modal, ProgressBar, LineChart
│   └── lib/
│       ├── prisma, auth, line-auth, liff
│       ├── nutrition, foods                  # 計算 + 食品DB
│       ├── ai (Claude)
│       ├── storage (ハイブリッド), utils
└── package.json, next.config.mjs, tailwind.config.ts, tsconfig.json
```

## デプロイ手順

### 1. データベース準備

Vercel Postgres / Supabase / Neon などで PostgreSQL DB を作成し、接続文字列を取得。

### 2. LINE Developers セットアップ

1. **LINE Login チャネル**を作成（または既存）
2. **LIFF アプリ**を1つ作成し、エンドポイント URL に Vercel の本番 URL を設定
3. **LIFF ID** と **チャネル ID** を控える
4. 必要なスコープ: `profile`, `openid` (＋ email を取得したい場合 `email`)

### 3. 自分（オーナー）の LINE userId を取得

LIFFをデプロイしたあと管理サイトに一度アクセスし、ログイン画面でログイン → エラー画面で開発者ツールから `console.log` または LIFF SDK の `liff.getProfile().then(p => console.log(p.userId))` で取得。

### 4. Vercel 環境変数

```bash
DATABASE_URL=postgresql://...                         # Postgres 接続文字列
ANTHROPIC_API_KEY=sk-ant-...                          # Claude API キー
LINE_LOGIN_CHANNEL_ID=1234567890                      # LINE Login チャネル ID（IDトークン検証用）
NEXT_PUBLIC_LIFF_ID=1234567890-abcdefgh               # LIFF ID（クライアント側）
OWNER_LINE_USER_IDS=Uxxxxxxxxxxxxxxxxxxx              # オーナー（カンマ区切り、複数可）
TRAINER_LINE_USER_IDS=Uxxxxxxxxxxxxxxxxxxx,Uyyy...    # トレーナー（カンマ区切り、複数可）
```

### 5. デプロイ

```bash
# Vercel ダッシュボードで「Import Project」
# Root Directory: nutrition-app
# Framework: Next.js（自動検出）
# Branch: claude/nutrition-fitness-tracker-Mvt0M
# Deploy
```

ビルド時に `prisma db push` が自動実行され、DBスキーマが作成されます。

### 6. 動作確認

- **ユーザー側**: `https://your-domain.vercel.app/` → オンボード → 食事記録
- **管理サイト**: `https://your-domain.vercel.app/admin/login` → LINEログイン

## ハイブリッド保存の挙動

| 状態 | データの保存先 |
|---|---|
| ゲスト（未ログイン） | IndexedDB（端末内） |
| LINE ログイン直後 | ローカル → サーバーへ自動同期、以降はサーバー |
| ログアウト | サーバーセッション切断（データはサーバーに残る） |

## カスタマイズ

- **食品DB**: `src/lib/foods.ts` の `FOODS` 配列に追記
- **目標プリセット**: `src/lib/nutrition.ts` の `GOAL_PRESETS`
- **ブランドカラー**: `tailwind.config.ts` の `brand` パレット
- **AIモデル**: `src/lib/ai.ts` の `MODEL`

## 今後の拡張

- LINE トーク内通知（食事忘れリマインド、トレーナーコメント通知）
- Apple ヘルスケア / Google Fit 連携
- トレーニングメニュー記録（kaloko本家の主要機能）
- 写真ギャラリー
- 外食チェーン店メニューDB追加
