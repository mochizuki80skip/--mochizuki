<?php
// php -S 用ルータ（本番の .htaccess と同じ動作: 実在するファイルはそのまま、他は index.php へ）
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$file = __DIR__ . '/../public' . $path;
if ($path !== '/' && is_file($file) && !str_ends_with($file, '.php')) return false;
if (str_ends_with($path, '/install.php') && is_file($file)) { require $file; return true; }
require __DIR__ . '/../public/index.php';
