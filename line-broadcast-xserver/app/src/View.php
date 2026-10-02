<?php
declare(strict_types=1);

final class View
{
    /**
     * views/{name}.php を描画し、レイアウトに埋め込んで出力する。
     * $layout: 'layout'（一覧系）/ 'channel_layout'（アカウント配下）/ null（レイアウトなし）
     */
    public static function render(string $name, array $vars = [], ?string $layout = 'layout'): void
    {
        $content = self::capture($name, $vars);
        if ($layout === null) {
            echo $content;
            return;
        }
        echo self::capture($layout, $vars + ['content' => $content]);
    }

    public static function capture(string $name, array $vars = []): string
    {
        extract($vars, EXTR_SKIP);
        ob_start();
        try {
            require APP_DIR . '/views/' . $name . '.php';
        } catch (Throwable $e) {
            ob_end_clean();
            throw $e;
        }
        return (string)ob_get_clean();
    }

    public static function partial(string $name, array $vars = []): void
    {
        echo self::capture('partials/' . $name, $vars);
    }
}
