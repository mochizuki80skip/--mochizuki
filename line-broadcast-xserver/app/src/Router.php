<?php
declare(strict_types=1);

final class Router
{
    /** @var array<int, array{string,string,callable,bool}> */
    private static array $routes = [];

    /** @param bool $csrf POST のとき CSRF トークンを検証するか（Webhook 等は false） */
    public static function add(string $method, string $pattern, callable $handler, bool $csrf = true): void
    {
        $regex = '#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>[^/]+)', $pattern) . '/?$#';
        self::$routes[] = [$method, $regex, $handler, $csrf];
    }

    public static function get(string $p, callable $h): void { self::add('GET', $p, $h); }
    public static function post(string $p, callable $h, bool $csrf = true): void { self::add('POST', $p, $h, $csrf); }

    public static function dispatch(string $method, string $path): void
    {
        foreach (self::$routes as [$m, $regex, $handler, $csrf]) {
            if ($m !== $method || !preg_match($regex, $path, $mm)) continue;
            if ($method === 'POST' && $csrf && !Auth::verifyCsrf()) {
                if (str_contains($path, '/api/')) json_error('セッションが切れました。ページを再読み込みしてください', 419);
                http_response_code(419);
                View::render('error', ['title' => 'セッションエラー', 'message' => 'ページの有効期限が切れました。前の画面に戻って再度お試しください。'], 'layout');
                return;
            }
            $params = array_filter($mm, 'is_string', ARRAY_FILTER_USE_KEY);
            $handler($params);
            return;
        }
        http_response_code(404);
        View::render('error', ['title' => 'ページが見つかりません', 'message' => 'お探しのページは存在しません。'], 'layout');
    }
}
