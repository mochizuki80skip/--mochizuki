# MEMBER'S CARD 提携店舗優待LP

80SKIP公式LINEのMEMBER'S CARDで受けられる、提携店舗の優待を案内する静的LP。
ビルドなし・単一の `index.html`。ハッシュで画面を切り替える（`#top` = 一覧、`#sporpia` = 詳細）。

- リポジトリ: GitHub（このフォルダ `memberscard-perks/`）
- 公開URL: https://partnership.hachimaru-80skip.com/
- サーバー: Xサーバー（GitHub Actions で FTPS 自動アップロード）

## ファイル

```
memberscard-perks/
├─ index.html          画面・スタイル・データ・スクリプト
├─ .htaccess           Xサーバー用（HTTPS統一・キャッシュ・圧縮）
├─ logo-80skip.webp  HACHIMARU SKIPロゴ（640x216）
├─ card.webp  MEMBER'S CARD画面（360x640）
├─ banner.webp  受け取りバナー（900x506）
└─ spopia.webp  スポーピアシラトリのロゴ（176x176）
```


## 公開手順（GitHub → Xサーバー）

1. Xサーバーのサーバーパネル → サブドメイン設定で `partnership.hachimaru-80skip.com` を追加（無料独自SSLも有効にする）
2. サーバーパネル → FTPアカウント設定 で、公開先フォルダに限定したFTPアカウントを作る（推奨）
3. GitHub → Settings → Secrets and variables → Actions に4つ登録

   | 名前 | 例 |
   |---|---|
   | `XSERVER_FTP_SERVER` | `sv12345.xserver.jp` |
   | `XSERVER_FTP_USERNAME` | FTPアカウント名 |
   | `XSERVER_FTP_PASSWORD` | FTPパスワード |
   | `XSERVER_FTP_DIR` | `/example.com/public_html/memberscard/`（末尾 `/` 必須。FTPアカウントを公開先に限定した場合は `/`） |

4. 既定ブランチに `memberscard-perks/` の変更を push すると、自動でアップロードされる
   （`.github/workflows/deploy-memberscard-perks.yml`。Actions タブから手動実行も可）
   - 作業ブランチへの push では本番に出ない
   - Secrets 未設定の間は、デプロイをスキップする
5. スマホのLINEアプリ内ブラウザで、表示・固定ボタン・電話・地図・ハッシュ遷移を確認
6. リッチメニュー等にURLを設定（UTM付き）
   - `https://partnership.hachimaru-80skip.com/?utm_source=line&utm_medium=richmenu`
   - `…?utm_source=line&utm_medium=greeting` / `…?utm_source=line&utm_medium=broadcast`

## 検索エンジンに載せない設定

LINEの会員向けLPのため、検索に出ないようにしている。
- `index.html` の `<meta name="robots" content="noindex, nofollow, noarchive">`
- `.htaccess` の `X-Robots-Tag`（画像にも効く）

`robots.txt` でクロールを禁止すると、検索エンジンが noindex を読めず、URLだけが検索結果に残ることがあるため、`robots.txt` は置かない。

## 計測

### GA4

`index.html` 冒頭の `window.GA_ID` に測定ID（`G-…`）を入れる。プレースホルダのままなら読み込まない。

| イベント | いつ | パラメータ |
|---|---|---|
| `page_view` | 初期表示・ハッシュ遷移 | `page_title`, `page_path`（`/top`・`/<id>`）, `page_location` |
| `line_click` | LINEリンク | `cta_location`（`fixed_bar` / `how_step1` / `banner`） |
| `tel_click` | 電話番号 | `store` |
| `map_click` | 地図で見る | `store` |
| `partner_click` | 一覧の提携先カード | `partner` |
| `partner_site_click` | 公式サイト | `partner` |
| `store_filter` | 都道府県チップ | `partner`, `pref` |
| `scroll_depth` | 25/50/75/100%（ページごとに1回） | `percent`, `page_path` |
| `ui_tap` | **すべてのリンク・ボタンのタップ** | `tap_id`, `tap_text`, `section`, `page_path` |

`ui_tap` は「どこが押されたか」を一覧で見るためのイベント。
`section` は `how` / `partners` / `banner` / `perks` / `rules` / `team` / `details` / `stores` / `site` / `fixed_bar`。

**GA4側の設定（必須）**: 管理 → カスタム定義 → カスタムディメンション（イベント）に、
`cta_location`, `store`, `partner`, `pref`, `percent`, `tap_id`, `tap_text`, `section` を登録する。
登録しないと、レポートでパラメータ別に見られない。

動作確認は `…/?debug=1` で開くと、ブラウザのコンソールに送信内容が出て、GA4のDebugViewにも入る。

### Microsoft Clarity（任意・無料）

タップ位置のヒートマップと操作の録画が見られる。https://clarity.microsoft.com でプロジェクトを作り、
`window.CLARITY_ID` にIDを入れる。空なら読み込まない。
※導入する場合は、プライバシーポリシーへの記載を確認すること。

## 提携先の追加

1. ロゴをWebP（正方形・約176px）にして、このフォルダに置く
2. `index.html` の `IMG` にキーを追加し、`PARTNERS` に1件追加（`id` は半角英数・公開後は変えない）
3. push → 自動で公開。一覧カードと詳細（`#id`）が増える

営業時間・休業日の変更は `stores` のデータだけを直す。
