# Karada Compass — 鍼灸院アプリ (Phase 1 MVP)

身体の状態を可視化し、改善プロセスを理解し、日常から治療を加速させるアプリ。

このリポジトリは **Phase 1 (MVP)** です。神経・循環・代謝の3軸での体質診断から、タイプ別解説と生活改善アドバイスまでを実装しています。

## Phase 1 で実装した機能

- ① **体質診断** — 15問 (3軸 × 5問) のリッカート問診
- ② **3軸スコアリング & タイプ判定** — 神経 / 循環 / 代謝
- ③ **レーダーチャート可視化** — カスタム SVG (依存ライブラリ無し)
- ④ **タイプ別解説** — 特徴 / 原因 (生活習慣・思考パターン) / 放置リスク
- ⑤ **生活改善アドバイス** — 睡眠 / 食事 / 運動 / ストレス
- Supabase クライアントの土台 (Phase 2 で履歴保存に利用予定)

## 判定タイプ

- バランスタイプ
- 神経過敏タイプ
- 循環不足タイプ
- 代謝低下タイプ
- 複合タイプ

## 開発・起動

```bash
cd clinic-app
npm install
npm run dev
```

`http://localhost:3000` でアクセスできます。

## ビルド

```bash
npm run build
npm run start
```

## Supabase 設定 (Phase 2 用)

Supabase プロジェクトを作成し、`.env.local` を以下のように設定:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Phase 1 では Supabase は接続しませんが、`lib/supabase.ts` でクライアントを初期化済みのため、Phase 2 から即利用可能です。

## ディレクトリ構成

```
clinic-app/
├── app/
│   ├── page.tsx          # ランディング
│   ├── diagnose/page.tsx # 問診フロー
│   ├── result/page.tsx   # 結果画面
│   ├── layout.tsx        # Noto Sans JP / メタデータ
│   └── globals.css
├── components/
│   ├── RadarChart.tsx    # 3軸レーダー (SVG)
│   ├── AxisBar.tsx       # 軸別スコアバー
│   └── ProgressBar.tsx   # 進捗
├── lib/
│   ├── questions.ts      # 15問の設問
│   ├── scoring.ts        # スコアリング & タイプ判定
│   ├── content.ts        # タイプ別の解説 & アドバイス
│   ├── storage.ts        # sessionStorage 永続化
│   ├── supabase.ts       # Supabase クライアント (Phase 2)
│   └── types.ts          # 型定義
└── tailwind.config.ts    # 白 × イエローのテーマ
```

## デザイン方針

- **テイスト**: 医療 × スタイリッシュ
- **配色**: ホワイトベース + イエロー (#F5C518) アクセント
- **フォント**: Noto Sans JP

## 次フェーズの予定

- Phase 2: お悩み回答BOT (Claude API), 日常記録 (Supabase 永続化)
- Phase 3: スタッフ側機能, 通院管理, 7回モデルの可視化
- Phase 4: 認証, LINE 連携, 予約・決済連携
