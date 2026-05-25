# 引き継ぎ資料 — LINE Platform（公式LINE運用 + 予約システム）

> 二人で開発を進めるための現状サマリ。これを読めば全体像と「次に何をすべきか」が分かります。
> 最終更新: 2026-05-15

---

## 1. これは何のプロジェクト？

**Lステップのような「公式LINE運用プラットフォーム」** ＋ **接骨院向けの予約システム**。
1 つの管理画面で **複数の LINE 公式アカウント** を運用でき、アカウントごとに友だち管理・配信・予約機能を持つ（マルチテナント）。

リポジトリ: `mochizuki80skip/--mochizuki` の **`line-platform/`** サブディレクトリ。
（同じリポジトリに `reserve/`（リカバリー鍼灸院の別予約サイト）、`clinic-app/`、ルートの PWA なども同居）

---

## 2. 技術スタック

| 領域 | 技術 |
|---|---|
| フレームワーク | Next.js 15（App Router）+ TypeScript |
| DB | PostgreSQL（Neon・Singapore リージョン）+ Prisma |
| 認証 | NextAuth（Credentials / メール+パスワード） |
| LINE | @line/bot-sdk（Messaging API）+ LIFF |
| 予約データ連携 | Google Sheets API（googleapis） |
| 定期実行 | cron-job.org（外部）→ `/api/cron/dispatch`（※未設定） |
| ホスティング | Vercel（Hobby プラン） |
| スタイル | Tailwind CSS（管理画面）/ 素の CSS（LIFF） |

---

## 3. 本番環境（重要）

| 項目 | 値 |
|---|---|
| 本番 URL | `https://line-platform-skip.vercel.app` |
| Vercel プロジェクト | `line-platform-skip` |
| Vercel Root Directory | `line-platform` |
| Vercel Production Branch | `claude/line-automation-platform-fs8Q5` |
| DB | Neon（プロジェクト名 line-platform） |
| 管理者ログイン | `mochizuki.80skip@gmail.com` / （初期パスワード。要変更推奨） |

### 環境変数（Vercel に設定済み）

```
DATABASE_URL                  Neon の接続文字列
NEXTAUTH_SECRET               セッション署名鍵
NEXTAUTH_URL                  https://line-platform-skip.vercel.app
ADMIN_EMAIL / ADMIN_PASSWORD  初期 super_admin
CRON_SECRET                   Cron 認証用
GOOGLE_SERVICE_ACCOUNT_JSON   Google サービスアカウントの JSON 全文
SKIP_LINE_SIGNATURE           （未使用 / ローカルデバッグ用）
```

⚠️ **`RESET_DB` は使用後に削除済み**。これを `true` にして再デプロイすると **DB が全消去** されるので絶対に付けないこと。

---

## 4. Git ブランチ運用（やや特殊・注意）

- 開発ブランチ: **`claude/line-automation-platform-fs8Q5`**
- Vercel が見るデフォルト相当ブランチ: **`claude/clinic-availability-site-0io9h`**

→ **両方に push が必要**。`claude/line-automation-platform-fs8Q5` にコミット後、
`claude/clinic-availability-site-0io9h` にマージ＆push してデプロイされる。

```bash
# 開発ブランチで作業＆push
git push origin claude/line-automation-platform-fs8Q5

# デフォルトブランチへマージ＆push（これでVercelが本番デプロイ）
git fetch origin claude/clinic-availability-site-0io9h
git checkout -b tmp origin/claude/clinic-availability-site-0io9h
git merge --no-ff claude/line-automation-platform-fs8Q5 -m "merge: ..."
git push origin tmp:claude/clinic-availability-site-0io9h
git checkout claude/line-automation-platform-fs8Q5
git branch -D tmp
```

### デプロイのハマりどころ（経験済み）
- **空コミットは Vercel がスキップする** → 実ファイル変更を入れること
- **Ignored Build Step は空にしてある**（以前これでビルドが走らなかった）
- **Vercel のレート制限** に当たることがある（少し待つ）
- ビルド時に `prisma db push --accept-data-loss` でスキーマ自動反映 + `seed.ts` で super_admin 作成（`package.json` の build スクリプト参照）

---

## 5. データモデル（Prisma）

### 運用基盤（マルチテナント）
- **AdminUser**: 管理ユーザー。`role` = `super_admin`（全権）/ `operator`（割当チャネルのみ）
- **LineChannel**: 各 LINE 公式アカウント。トークン・シークレット・色などを保持
- **ChannelMembership**: AdminUser × LineChannel の権限（owner / operator）

### LINE 運用
- **Friend**: 友だち（チャネル単位、`[lineChannelId, lineUserId]` でユニーク）
- **Tag / FriendTag**: タグ
- **InboundMessage**: 受信メッセージ履歴
- **Broadcast / BroadcastTag**: 一斉配信
- **Scenario / ScenarioStep / ScenarioRun / ScenarioRunStep**: ステップ配信
- **DeliveryLog**: 配信ログ

### 予約機能（接骨院向け・チャネル単位）
- **ReservationSettings**: 予約設定（有効化フラグ・粒度・ベッド数・LIFF ID・院情報・Sheet ID・色など）
- **Service**: メニュー（名前・所要分・価格）
- **BusinessHours**: 曜日別営業時間
- **Holiday**: 臨時休業日
- **ReferralSource**: 「知ったきっかけ」プルダウン項目
- **Reservation**: 予約データ（DB が一次・Sheet にミラー）

---

## 6. 画面構成（URL）

### 管理画面（要ログイン）
```
/login                                  ログイン
/dashboard                              LINE アカウント一覧（super_admin はカード表示）
/dashboard/channels                     LINE 管理（super_admin のみ）
/dashboard/channels/new                 LINE アカウント追加
/dashboard/c/[channelId]                チャネルのダッシュボード
/dashboard/c/[channelId]/friends        友だち
/dashboard/c/[channelId]/tags           タグ
/dashboard/c/[channelId]/broadcasts     一斉配信
/dashboard/c/[channelId]/scenarios      ステップ配信
/dashboard/c/[channelId]/reservations   予約一覧（予約機能 ON 時のみメニュー表示）
/dashboard/c/[channelId]/reservations/settings  予約設定
/dashboard/c/[channelId]/settings       チャネル設定・メンバー管理
```

### 公開（認証不要・middleware で除外済み）
```
/liff/[channelId]                       LIFF 予約カレンダー（お客様用）
/api/public/[channelId]/services        メニュー一覧
/api/public/[channelId]/availability    空き状況
/api/public/[channelId]/referrals       きっかけ選択肢
/api/public/[channelId]/reservations    予約確定（POST）
/api/line/webhook/[channelId]           LINE Webhook（チャネル毎）
/api/cron/dispatch                      予約配信・ステップ配信の定期実行
```

---

## 7. 主要ロジックの場所（src/lib）

| ファイル | 役割 |
|---|---|
| `prisma.ts` | Prisma クライアント |
| `auth.ts` | NextAuth 設定（role をセッションに含める） |
| `permissions.ts` | 権限チェック（getCurrentUser / requireChannel / requireSuperAdmin など） |
| `line.ts` | チャネル単位の LINE クライアント（トークンは DB から、メモリキャッシュ） |
| `signature.ts` | Webhook 署名検証 |
| `broadcast.ts` | 一斉配信（broadcast / multicast 自動切替） |
| `scenario.ts` | ステップ配信（予約・発火・競合防止） |
| `reservation.ts` | 空き状況計算 + 予約作成（DBトランザクションで二重予約防止） |
| `sheets.ts` | Google Sheets API（読み書き・書式設定） |
| `sheetSync.ts` | 全タブ同期 + スケジュールタブ（日×時間マトリクス）生成 |

---

## 8. 現在の到達点（DONE）

- ✅ 公式LINE運用基盤（友だち / タグ / 一斉配信 / ステップ配信）
- ✅ マルチテナント（複数 LINE）+ 権限管理（super_admin / operator）
- ✅ 本番デプロイ（Vercel + Neon）・管理者ログイン動作確認済み
- ✅ 予約機能の基盤（DB・管理画面・設定 UI）
- ✅ LIFF 予約カレンダー（ターコイズブルー・3 ステップ）
- ✅ Google Sheets 連携（予約自動追記 + スケジュールタブ + 各種設定タブ）

### 稼働中の実データ
- 接骨院チャネル「なつめ接骨院 瀬名中央店」を 1 つ登録済み
  - channelId: `cmp6adwyo0000mor0liuxc7ab`
  - 予約機能 ON、メニュー「初めての方（20分）」登録済み
  - Google スプレッドシート連携・接続テスト成功済み

---

## 9. 未完了 / 次にやること（TODO）

### A. デプロイ周りの最終確認
- [ ] 最新コミット（スケジュールタブ機能）が本番反映されたか確認
- [ ] 「📋 シートを完全同期」ボタンでスケジュールタブが生成されるか確認

### B. LINE 連携の残作業（接骨院チャネル）
- [ ] LIFF アプリを LINE Developers Console で作成 → LIFF ID を予約設定に入力
- [ ] リッチメニューに LIFF URL（`https://liff.line.me/{LIFF ID}`）を設定
- [ ] Webhook URL を各チャネルの専用 URL に設定

### C. cron-job.org の設定（予約・ステップ配信の自動実行）
- [ ] cron-job.org で `/api/cron/dispatch` を 1 分毎に叩く設定
  - Header: `Authorization: Bearer {CRON_SECRET}`

### D. 設計判断が必要（リカバリー風予約への改修）
ユーザーは「リカバリー鍼灸院の予約サイト（`reserve/`）の仕組みを line-platform に取り込みたい」と要望。
`reserve/` は **「予約確定 = LINE トークにテキスト自動入力して送信 → スタッフ手動対応」** 方式。
現在の line-platform 予約は **「LIFF 内で確定 → DB 保存 + Sheet 追記」** 方式。

→ **どちらの方式にするか / UI 要素（来院パターン・第1〜3希望・oaMessage 連携・チラシ限定メニュー）をどこまで取り込むか** が未決定。
（詳細は会話ログ参照。おすすめは「UI はリカバリー風、確定は DB + LINE 通知」のハイブリッド）

### E. セキュリティ
- [ ] 管理者パスワードを強固なものに変更（初期値 `80skip` は脆弱）
- [ ] チャット内に露出したシークレット類のローテーション
  - Neon DB パスワード、LINE チャネルシークレット

---

## 10. ローカル開発の始め方

```bash
cd line-platform
npm install
cp .env.example .env   # 値を埋める（DATABASE_URL は開発用 or Neon）
npx prisma generate
npm run dev            # http://localhost:3001
```

- 型チェック: `npx tsc --noEmit`
- ビルド確認: `DATABASE_URL=... NEXTAUTH_SECRET=... npx next build`

---

## 11. 参考：リカバリー予約サイト（reserve/）の仕組み

別ディレクトリ `reserve/` にある既存の予約サイト。今後 line-platform に取り込む参考元。

- **threease**（外部予約 SaaS）の API をプロキシして空き状況を表示
- 4 ステップ: 来院パターン → コース → 日時（第1〜3希望） → LINE 送信
- 予約確定は **LINE `oaMessage` スキーム**でトークにテキスト自動入力 → スタッフ手動対応
- `?promo=code` でチラシ限定メニューを出し分け（Upstash Redis + `/admin`）
- 配色: 黒 + ゴールド。line-platform 版はターコイズブルー。
