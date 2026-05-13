# ONE'S BODY 返信アシスタント

kaloko アプリの「お約束機能」(歩数 5000 歩 / 水 2L など) への返信を、
お客様一人ひとりの目標と距離感に合わせて生成する Web ツールです。

店舗スタッフ数名で使うことを想定しています。

## ステータス

**Week 1 (基盤) 完了。**

- 認証 (Supabase)
- お客様 CRUD
- お約束 CRUD
- Gemini API 疎通 (`POST /api/generate-reply`)

Week 2 で「返信作成画面」を、Week 3 で「距離感 AI 提案 / トーン切替 / スマホ UI 仕上げ」を実装予定です。

## 必要なもの

- Node.js 20+
- [Supabase](https://supabase.com) プロジェクト (無料枠でOK)
- [Google Gemini API キー](https://aistudio.google.com/apikey) (完全無料・クレカ不要)

## セットアップ

### 1. Supabase プロジェクトを作る

1. https://supabase.com にログインしてプロジェクトを作成
2. プロジェクト設定 > API から `Project URL` と `anon key` を控える
3. SQL Editor を開き、`supabase/schema.sql` の中身を貼り付けて **Run**
4. Authentication > Sign In / Providers で「Email」を有効化
   (Confirm email を ON のままで OK)

### 2. 環境変数を設定

```bash
cp .env.local.example .env.local
```

`.env.local` を編集:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash
```

**Gemini API キーの取り方:**
1. https://aistudio.google.com/apikey にアクセス(Google ログイン)
2. 「Create API key」→ Google Cloud プロジェクトを選ぶ(or 新規作成)
3. 表示された `AIza...` の文字列をコピー
4. クレジットカード登録は不要。無料枠で1日 1500 回まで呼べます

### 3. インストール & 起動

```bash
npm install
npm run dev
```

→ http://localhost:3000 を開く

初回はログイン画面で「新しいスタッフを登録」からアカウントを作成してください。
確認メールが届くのでリンクをクリック → 再度ログイン。

### 4. 本番デプロイ (Vercel 想定)

1. このリポジトリを Vercel に import
2. 環境変数を同じく Vercel 側に設定
3. Supabase の Authentication > URL Configuration で
   `Site URL` に Vercel の本番 URL を追加

## 画面

| パス | 内容 |
|------|------|
| `/login` | スタッフログイン / 新規登録 |
| `/customers` | お客様一覧 |
| `/customers/new` | 新規お客様登録 |
| `/customers/[id]` | プロフィール編集 + お約束管理 |

## API

### POST /api/generate-reply

返信案を 3 つ生成 (Gemini)。Week 2 で UI と接続予定。

リクエスト:
```json
{
  "customerId": "uuid",
  "achievements": [
    { "promiseTitle": "歩数", "status": "miss", "value": 3200, "unit": "歩" },
    { "promiseTitle": "水", "status": "done", "value": 2.1, "unit": "L" }
  ],
  "customerMsg": "今日は仕事忙しくて…",
  "tone": "encourage"
}
```

レスポンス:
```json
{ "suggestions": ["案1", "案2", "案3"] }
```

## ディレクトリ構成

```
auto-reply-tool/
├── supabase/
│   └── schema.sql              # DB スキーマ (RLS 含む)
└── src/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx            # ホーム
    │   ├── login/              # ログイン画面
    │   ├── auth/               # auth コールバック / ログアウト
    │   ├── customers/          # お客様 CRUD
    │   └── api/
    │       └── generate-reply/ # Gemini API
    ├── lib/
    │   ├── supabase/           # client / server / middleware
    │   └── gemini.ts           # Google GenAI SDK
    └── middleware.ts           # 未ログイン時 /login にリダイレクト
```

## 既知の制限

- kaloko 側から過去返信を自動で取り込む機能はありません。
  使いながら少しずつ蓄積していく運用です (CSV 一括取り込みは将来追加予定)。
