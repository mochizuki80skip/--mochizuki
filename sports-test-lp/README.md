# アローズのスポーツ適性検査 LP（Xサーバー用）

## フォルダ構成
```
sports-test-lp/
├── index.html        … ページ本体（デザイン・文章）
├── settings.js       … LINE・電話番号・カレンダーのURL（管理画面が自動で書き換え）
├── admin.php         … 管理画面
├── admin-config.php  … 管理画面のパスワード（暗号化済み）と設定値。手で編集しない
└── img/          … 画像（20ファイル。ogp.jpg はシェア用画像）
```

## 公開URL
https://arrowz-event.hachimaru-80skip.com/

## アップロード方法（Xサーバー）
1. このフォルダの「中身」（`index.html` / `settings.js` / `admin.php` / `admin-config.php` / `img/`）を、サブドメインの公開フォルダの直下にアップロード
   - Xサーバーの初期設定では `hachimaru-80skip.com/public_html/arrowz-event/` が公開フォルダです
   - アップロード後の場所：`…/public_html/arrowz-event/index.html`
2. 上の公開URLで表示を確認
3. `index.html` / `settings.js` / `img/` の位置関係は変えないでください
   - README.md はアップロードしなくて構いません

## URLを変える場合
`index.html` の先頭にある `canonical` / `og:url` / `og:image` / `twitter:image` の4か所のURLも、新しいURLに合わせて書き換えてください。
（LINEやXでシェアしたときの画像 `img/ogp.jpg` が出なくなるのを防ぐためです）

## リンク先を変えたいとき（管理画面）
1. https://arrowz-event.hachimaru-80skip.com/admin.php を開いてログイン
2. LINE・電話番号・空き状況カレンダー（2種類）を入力して「保存してLPに反映」
   - LINE 5か所・電話 6か所と番号の表示・カレンダー 2か所がまとめて切り替わります
   - 間違えたときは「ひとつ前の設定に戻す」で戻せます
3. パスワードは管理画面の「パスワードを変更する」から変更できます
   - 5回続けて間違えると15分間ログインできなくなります

### 注意
- 管理画面は `index.html` を直接書き換えます。`index.html` を作り直して上書きアップロードしたときは、そのあと管理画面で一度「保存」してください
- `admin-config.php` を上書きアップロードすると、パスワードと設定値が初期状態に戻ります
- 保存できないと表示されたら、`index.html` と `settings.js` のパーミッションを 644（または 604）にしてください

## 文章や写真を差し替えたいとき
- 写真：`img/` 内の同じ名前のファイルを上書き（縦横比をそろえると見た目が崩れません）
- 文章：`index.html` を編集
