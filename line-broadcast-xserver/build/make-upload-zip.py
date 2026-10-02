#!/usr/bin/env python3
"""Xserver へ FTP でアップロードするための ZIP を作る。

    python3 build/make-upload-zip.py        # dist/line-broadcast-xserver-upload.zip ができる

ZIP の中身:
    START-HERE_はじめに.txt   最短の手順
    upload/public_html/       → サーバーの public_html/ にアップロード（.htaccess を含む）
    upload/app/               → サーバーの public_html と同じ階層に app/ としてアップロード
    docs/                     手順書（アップロードは不要）
"""
import os, sys, zipfile, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'dist', 'line-broadcast-xserver-upload.zip')
os.makedirs(os.path.dirname(OUT), exist_ok=True)

README = """接骨院 LINE 一括配信（Xserver 版） アップロード用ファイル
=========================================================

■ 最短の手順（詳しくは docs/Xserver導入手順書.md）

 1. Xserver のサーバーパネルで、設置するドメイン（またはサブドメイン）の
    「無料独自SSL」と「PHP 8.1 以上」を設定する
 2. サーバーパネルで MySQL のデータベースとユーザーを作る
    （MySQL ホスト名・データベース名・ユーザー名・パスワードを控える）
 3. FTP ソフトで、この ZIP の中身を次のようにアップロードする
      upload/public_html/ の中身すべて → /home/サーバーID/ドメイン名/public_html/
      upload/app/ フォルダごと          → /home/サーバーID/ドメイン名/app/
    ※ .htaccess（ドットで始まる隠しファイル）も必ずアップロードしてください。
      FTP ソフトの設定で「隠しファイルを表示」をオンにします。
 4. ブラウザで https://ドメイン名/ を開くとセットアップ画面が出る
    → データベース情報・公開URL・管理者のログインIDとパスワードを入力
 5. 完了画面に出る「アクセス用 URL」を必ず控える（このURLを開いた端末だけが使えます）
 6. サーバーパネルの「Cron設定」で、毎分実行を登録する
      /usr/bin/php8.2 /home/サーバーID/ドメイン名/app/cron.php
 7. docs/アカウント接続手順書.md に従って、LINE 公式アカウントを接続する

■ 注意
 - このシステムは検索エンジンに載らず、アクセス用 URL を知らない人には 404 が表示されます。
 - app/config.php（セットアップで自動作成）には暗号化キーが入っています。バックアップを取ってください。
 - セットアップ後、install.php が残っていたら削除してください（通常は自動で削除されます）。
"""

SKIP_DIRS = {'tests', 'build', 'dist', 'docs', '.git', 'node_modules'}


def add_tree(z, src, dst, skip=lambda rel: False):
    for dp, dn, fn in os.walk(src):
        dn[:] = sorted(d for d in dn)
        for f in sorted(fn):
            full = os.path.join(dp, f)
            rel = os.path.relpath(full, src)
            if skip(rel) or f in ('.DS_Store', '.gitkeep') and False:
                continue
            z.write(full, os.path.join(dst, rel).replace(os.sep, '/'))


def skip_app(rel):
    rel = rel.replace(os.sep, '/')
    if rel == 'config.php':
        return True  # 秘密情報。セットアップで作られる
    if rel.startswith('storage/media/') and not rel.endswith('.gitkeep'):
        return True
    if rel.startswith('storage/logs/') and not rel.endswith('.gitkeep'):
        return True
    return False


with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
    info = zipfile.ZipInfo('START-HERE_はじめに.txt', time.localtime()[:6])
    info.compress_type = zipfile.ZIP_DEFLATED
    z.writestr(info, README.replace('\n', '\r\n'))  # Windows のメモ帳で読めるように
    add_tree(z, os.path.join(ROOT, 'public'), 'upload/public_html')
    add_tree(z, os.path.join(ROOT, 'app'), 'upload/app', skip_app)
    for f in sorted(os.listdir(os.path.join(ROOT, 'docs'))):
        if f.endswith('.md'):
            z.write(os.path.join(ROOT, 'docs', f), 'docs/' + f)

print(OUT, os.path.getsize(OUT), 'bytes')
