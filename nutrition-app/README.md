# ONE'S MEAL

ONE'S BODY パーソナルジム会員向けの食事・体組成管理 PWA。
あすけんを参考に、ジムのトレーナーが関与できる設計に絞り込んだ最小実用版。

## 機能

- **オンボーディング**: 性別/年齢/身長/体重/活動量/目標から BMR（Mifflin-St Jeor）/TDEE/PFC 目標を自動算出
- **食事記録**: 約180品目の日本食品DBから検索、量を調整して朝/昼/夕/間食に登録
- **写真AI解析**: スマホで料理を撮影 → Claude Vision が食品名と栄養価を推定
- **手入力**: 自家製料理や外食を自由入力
- **体重記録**: 折れ線グラフで7日/30日/90日の推移、目標体重との差表示
- **AIアドバイス**: Claude が今日の食事内容を分析し具体的アドバイス（不足栄養素、明日の提案、週次レポート）
- **会員モード**: 会員コードまたは LINE ログイン（LIFF）で認証。一般ゲストモードと切り分け
- **PWA**: オフラインキャッシュ、ホーム画面追加、iOS Safe Area 対応
- **データエクスポート/インポート**: JSON 形式でバックアップ可能

## ディレクトリ構成

```
nutrition-app/
  index.html           # SPA エントリ
  app.js               # メインロジック
  style.css            # デザインシステム
  manifest.json, sw.js, icon.svg
  js/
    db.js              # IndexedDB ラッパー
    foods.js           # 日本食品DB
    nutrition.js       # BMR/TDEE/PFC 計算
    charts.js          # Canvas チャート
    ai.js              # Claude API クライアント（フォールバック付き）
    liff.js            # LINE LIFF 連携
    auth.js            # 会員 / ゲスト管理
  api/
    advice.js          # Claude API（栄養アドバイス）
    analyze-photo.js   # Claude Vision（食事写真解析）
  vercel.json
```

## デプロイ

### Vercel

1. このリポジトリを Vercel に接続し、`nutrition-app/` をルートに指定
2. 環境変数を設定:
   - `ANTHROPIC_API_KEY` — Claude API キー
3. デプロイ → `/index.html` でアクセス可能

### ローカル動作確認

PWA 部分のみであれば任意の静的サーバーで動作（AI機能はフォールバックの簡易アドバイスのみ）:

```sh
cd nutrition-app
python3 -m http.server 8080
```

### LINE LIFF 設定（会員機能を LINE で使う場合）

1. LINE Developers で LIFF アプリを作成し、エンドポイント URL に Vercel の本番 URL を設定
2. 取得した LIFF ID を、設定→データ→（KV 内 `liffId`）に保存
3. `index.html` の `<head>` に LIFF SDK を追加:
   ```html
   <script charset="utf-8" src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
   ```
4. 会員モードから「LINE でログイン」が利用可能に

## カスタマイズ

- **食品DB追加**: `js/foods.js` の `FOODS` 配列に追記
- **会員コード**: `js/auth.js` の `MEMBER_CODES` を変更（実運用ではサーバー側検証推奨）
- **AIモデル**: `api/advice.js` `api/analyze-photo.js` の `MODEL` を変更
- **目標係数**: `js/nutrition.js` の `GOAL_PRESETS` で PFC 比率と kcal 調整値を変更

## 今後の拡張候補

- トレーナー管理画面（会員の食事ログ閲覧 + コメント）
- ジムトレーニング記録との連動（消費カロリー加算）
- LINE プッシュ通知（食事忘れリマインド、週次レポート配信）
- 外食チェーン店メニュー DB の追加
- 食事写真ギャラリーと履歴検索
