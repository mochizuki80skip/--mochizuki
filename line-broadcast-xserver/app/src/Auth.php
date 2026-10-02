<?php
declare(strict_types=1);

final class Auth
{
    private static ?array $user = null;
    private static ?array $channelsCache = null;

    public static function startSession(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) return;
        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
        session_name('linehub');
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => (defined('BASE_PATH') && BASE_PATH !== '') ? BASE_PATH . '/' : '/',
            'secure' => $https,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        ini_set('session.gc_maxlifetime', (string)(60 * 60 * 24 * 7));
        session_start();
    }

    public static function user(): ?array
    {
        if (self::$user !== null) return self::$user;
        $id = $_SESSION['uid'] ?? null;
        if (!$id) return null;
        self::$user = Db::one('SELECT id, email, name, role FROM admin_users WHERE id = ?', [$id]);
        if (!self::$user) unset($_SESSION['uid']);
        return self::$user;
    }

    public static function isAdmin(): bool
    {
        return (self::user()['role'] ?? '') === 'super_admin';
    }

    public static function requireLogin(): array
    {
        $u = self::user();
        if (!$u) {
            if (str_contains((string)($_SERVER['REQUEST_URI'] ?? ''), '/api/')) json_error('ログインが必要です', 401);
            redirect('/login');
        }
        return $u;
    }

    public static function requireAdmin(): array
    {
        $u = self::requireLogin();
        if ($u['role'] !== 'super_admin') {
            if (str_contains((string)($_SERVER['REQUEST_URI'] ?? ''), '/api/')) json_error('管理者のみ操作できます', 403);
            http_response_code(403);
            View::render('error', ['title' => '権限がありません', 'message' => 'この操作は管理者のみ可能です。'], 'layout');
            exit;
        }
        return $u;
    }

    /**
     * ログイン試行。失敗が続く IP は一定時間ブロック（15分で10回まで）
     * @return array{ok:bool,error?:string}
     */
    public static function attempt(string $loginId, string $password, string $ip): array
    {
        Db::exec('DELETE FROM login_attempts WHERE attempted_at < ?', [gmdate('Y-m-d H:i:s', time() - 3600)]);
        $recent = (int)Db::val('SELECT COUNT(*) FROM login_attempts WHERE ip = ? AND attempted_at > ?', [$ip, gmdate('Y-m-d H:i:s', time() - 900)]);
        if ($recent >= 10) return ['ok' => false, 'error' => 'ログイン試行が多すぎます。15分ほど待ってからやり直してください。'];

        $u = Db::one('SELECT * FROM admin_users WHERE email = ?', [trim($loginId)]);
        // 存在しないユーザーでも処理時間を揃える
        $hash = $u['password_hash'] ?? '$2y$10$abcdefghijklmnopqrstuuWnYV2Ys3v1o7VvT3t0d9N7Zb7G7q5QK';
        if (!password_verify($password, $hash) || !$u) {
            Db::exec('INSERT INTO login_attempts (ip, attempted_at) VALUES (?, ?)', [$ip, now_utc()]);
            return ['ok' => false, 'error' => 'ログインIDまたはパスワードが違います。'];
        }
        session_regenerate_id(true);
        $_SESSION['uid'] = (int)$u['id'];
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
        return ['ok' => true];
    }

    public static function logout(): void
    {
        $_SESSION = [];
        if (session_status() === PHP_SESSION_ACTIVE) session_destroy();
    }

    /** ログイン中ユーザーがアクセスできる有効なアカウント一覧 */
    public static function channels(): array
    {
        if (self::$channelsCache !== null) return self::$channelsCache;
        $u = self::user();
        if (!$u) return self::$channelsCache = [];
        if ($u['role'] === 'super_admin') {
            return self::$channelsCache = Db::all('SELECT * FROM line_channels WHERE is_active = 1 ORDER BY id');
        }
        return self::$channelsCache = Db::all(
            'SELECT c.* FROM line_channels c JOIN memberships m ON m.channel_id = c.id
             WHERE m.admin_user_id = ? AND c.is_active = 1 ORDER BY c.id',
            [$u['id']]
        );
    }

    public static function channelIds(): array
    {
        return array_map(fn($c) => (int)$c['id'], self::channels());
    }

    /** アクセス権のあるアカウントを返す（無ければ 403/404）。無効化されたアカウントは管理者のみ */
    public static function requireChannel(int $id): array
    {
        $u = self::requireLogin();
        $ch = Db::one('SELECT * FROM line_channels WHERE id = ?', [$id]);
        $isApi = str_contains((string)($_SERVER['REQUEST_URI'] ?? ''), '/api/');
        if (!$ch) {
            if ($isApi) json_error('アカウントが見つかりません', 404);
            http_response_code(404);
            View::render('error', ['title' => '見つかりません', 'message' => 'アカウントが見つかりません。'], 'layout');
            exit;
        }
        $ok = $u['role'] === 'super_admin'
            || (bool)Db::val('SELECT 1 FROM memberships WHERE admin_user_id = ? AND channel_id = ?', [$u['id'], $id]);
        if (!$ok) {
            if ($isApi) json_error('このアカウントの権限がありません', 403);
            http_response_code(403);
            View::render('error', ['title' => '権限がありません', 'message' => 'このアカウントへのアクセス権がありません。'], 'layout');
            exit;
        }
        return $ch;
    }

    public static function verifyCsrf(): bool
    {
        $sent = $_POST['_csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
        return is_string($sent) && $sent !== '' && hash_equals($_SESSION['csrf'] ?? '', $sent);
    }
}
