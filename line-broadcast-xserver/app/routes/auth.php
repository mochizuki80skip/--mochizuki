<?php
declare(strict_types=1);

Router::get('/', function () {
    redirect(Auth::user() ? '/dashboard' : '/login');
});

Router::get('/login', function () {
    if (Auth::user()) redirect('/dashboard');
    View::render('auth/login', ['error' => flash()['message'] ?? null], null);
});

Router::post('/login', function () {
    $loginId = (string)($_POST['login_id'] ?? '');
    $r = Auth::attempt($loginId, (string)($_POST['password'] ?? ''), (string)($_SERVER['REMOTE_ADDR'] ?? ''));
    if (!$r['ok']) {
        http_response_code(401);
        View::render('auth/login', ['error' => $r['error'], 'loginId' => $loginId], null);
        return;
    }
    redirect('/dashboard');
});

Router::post('/logout', function () {
    Auth::logout();
    redirect('/login');
});

Router::get('/account/password', function () {
    Auth::requireLogin();
    View::render('auth/password', ['title' => 'パスワード変更']);
});

Router::post('/account/password', function () {
    $u = Auth::requireLogin();
    $row = Db::one('SELECT password_hash FROM admin_users WHERE id = ?', [$u['id']]);
    $new = (string)($_POST['new'] ?? '');
    if (!password_verify((string)($_POST['current'] ?? ''), $row['password_hash'])) {
        flash('現在のパスワードが違います', 'error');
    } elseif (mb_strlen($new) < 8) {
        flash('新しいパスワードは 8 文字以上にしてください', 'error');
    } else {
        Db::exec('UPDATE admin_users SET password_hash = ? WHERE id = ?', [password_hash($new, PASSWORD_DEFAULT), $u['id']]);
        flash('パスワードを変更しました');
    }
    redirect('/account/password');
});
