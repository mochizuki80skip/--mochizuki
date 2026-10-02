# CSS のビルド（開発者向け。サーバーでは不要）

画面のスタイルは Tailwind CSS で作り、ビルド済みの `public/assets/app.css` を同梱しています。
画面（`app/views` など）の見た目を変えたときだけ、手元の PC で再ビルドしてください。

```bash
cd build
npm install            # tailwindcss@3 が入ります
npm run build          # ../public/assets/app.css を再生成
```
