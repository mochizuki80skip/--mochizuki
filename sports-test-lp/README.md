# アローズのスポーツ適性検査 LP（Xサーバー用）

## フォルダ構成
```
sports-test-lp/
├── index.html    … ページ本体（デザイン・文章）
├── settings.js   … LINE・電話番号・カレンダーのURL設定
└── img/          … 画像（20ファイル。ogp.jpg はシェア用画像）
```

## 公開URL
https://arrowz-event.hachimaru-80skip.com/

## アップロード方法（Xサーバー）
1. このフォルダの「中身」（`index.html` / `settings.js` / `img/`）を、サブドメインの公開フォルダの直下にアップロード
   - Xサーバーの初期設定では `hachimaru-80skip.com/public_html/arrowz-event/` が公開フォルダです
   - アップロード後の場所：`…/public_html/arrowz-event/index.html`
2. 上の公開URLで表示を確認
3. `index.html` / `settings.js` / `img/` の位置関係は変えないでください
   - README.md はアップロードしなくて構いません

## URLを変える場合
`index.html` の先頭にある `canonical` / `og:url` / `og:image` / `twitter:image` の4か所のURLも、新しいURLに合わせて書き換えてください。
（LINEやXでシェアしたときの画像 `img/ogp.jpg` が出なくなるのを防ぐためです）

## リンク先を変えたいとき
`settings.js` の上の方にある値だけを書き換えて、`settings.js` を上書きアップロードしてください。
（LINE 5か所・電話 6か所・カレンダー 2か所がまとめて切り替わります）

## 文章や写真を差し替えたいとき
- 写真：`img/` 内の同じ名前のファイルを上書き（縦横比をそろえると見た目が崩れません）
- 文章：`index.html` を編集
