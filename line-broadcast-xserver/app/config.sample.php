<?php
// config.sample.php を config.php にコピーして値を設定する（install.php が自動で作成することもできます）。
// config.php は秘密情報を含むため、Web から見える場所に置かないこと。
return [
    'db' => [
        'host' => 'localhost',          // Xserver は通常 localhost ではなくサーバーパネル記載の「MySQLホスト名」
        'name' => 'xxxx_linehub',
        'user' => 'xxxx_linehub',
        'pass' => '',
    ],
    // このシステムの公開URL（末尾スラッシュなし）。LINE が画像を取得するURLの起点。例: https://example.com/line
    'base_url' => '',
    // アクセストークン等の暗号化キー（32バイトを base64 にした文字列）。インストーラーが自動生成。紛失すると復号できません
    'app_key' => '',
    // 画面に表示するシステム名
    'app_name' => '接骨院 LINE 一括配信',
    // 入口の保護キー（英数字 16 文字以上）。設定すると「https://ドメイン/?k=このキー」を開いた端末だけが画面を見られる。
    // キーを知らない人には 404（存在しないページ）が返る。LINE の Webhook・画像取得・cron には影響しない。空なら無効
    'access_key' => '',
    // HTTP 経由で cron を呼ぶ場合の合言葉（空なら HTTP 経由の実行は無効。通常は空でOK）
    'cron_secret' => '',
    // LINE API のエンドポイント（テスト用。通常は変更しない）
    'line_api_base' => 'https://api.line.me',
    'debug' => false,
];
