<?php
// このファイルを config.php という名前でコピーして、値を書き換えてください。
return [
    // ログイン用のパスワード（院内スタッフ共通）。推測されにくい長いものにする
    'password' => 'change-me',

    // 内容書をメールで送る時の送り主（Xサーバーで作成した、このドメインのメールアドレス）
    // 例: 'info@mitsukaru-sekkotsuin.jp'。空のままだとメール送信は使えない
    'mail_from' => '',
    'mail_from_name' => 'ミツカル接骨院',
    // 送ったメールの控えを受け取るアドレス（任意。空なら送らない）
    'mail_bcc' => '',

    // ログイン状態を保つ日数
    'login_days' => 30,

    // データの保存先。空のままなら SQLite（このフォルダの data/shinq.sqlite）を使う。
    // Xサーバーの MySQL を使う場合は、サーバーパネルで作成したデータベースの情報を入れる
    'mysql' => [
        'host' => '',          // 例: mysql1234.xserver.jp
        'dbname' => '',        // 例: xs123456_shinq
        'user' => '',          // 例: xs123456_shinq
        'password' => '',
    ],
];
