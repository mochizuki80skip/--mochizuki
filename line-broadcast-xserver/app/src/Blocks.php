<?php
declare(strict_types=1);

final class ValidationError extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 400)
    {
        parent::__construct($message);
    }
}

/**
 * 編集画面のブロック定義の検証と、LINE Messaging API 形式への変換。
 *   text  : テキスト
 *   image : 画像
 *   rich  : リッチメッセージ（imagemap）
 *   cards : カードタイプ（flex carousel）
 */
final class Blocks
{
    public const MAX_BLOCKS = 5;
    public const MAX_CARDS = 10;
    public const MAX_BUTTONS = 3;

    /** リッチメッセージのタップ領域レイアウト（x, y, w, h は 0〜1 の割合） */
    public const RICH_LAYOUTS = [
        '1'  => [[0, 0, 1, 1]],
        '2h' => [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]],
        '2v' => [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]],
        '3c' => [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]],
        '4'  => [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]],
        '6'  => [
            [0, 0, 1 / 3, 0.5], [1 / 3, 0, 1 / 3, 0.5], [2 / 3, 0, 1 / 3, 0.5],
            [0, 0.5, 1 / 3, 0.5], [1 / 3, 0.5, 1 / 3, 0.5], [2 / 3, 0.5, 1 / 3, 0.5],
        ],
    ];

    /** @return array 正規化済みのブロック配列（不正なら ValidationError） */
    public static function validate(mixed $blocks): array
    {
        if (!is_array($blocks) || !array_is_list($blocks) || count($blocks) < 1) {
            throw new ValidationError('メッセージを 1 つ以上追加してください');
        }
        if (count($blocks) > self::MAX_BLOCKS) throw new ValidationError('メッセージは最大 ' . self::MAX_BLOCKS . ' つまでです');

        $out = [];
        foreach ($blocks as $b) {
            if (!is_array($b)) throw new ValidationError('メッセージの形式が不正です');
            $out[] = match ($b['type'] ?? '') {
                'text'  => self::text($b),
                'image' => ['type' => 'image', 'mediaId' => self::mediaId($b['mediaId'] ?? '')],
                'rich'  => self::rich($b),
                'cards' => self::cards($b),
                default => throw new ValidationError('未対応のメッセージ種別です'),
            };
        }
        return $out;
    }

    private static function str(mixed $v): string
    {
        return is_string($v) ? trim($v) : '';
    }

    private static function text(array $b): array
    {
        $t = is_string($b['text'] ?? null) ? $b['text'] : '';
        if (trim($t) === '') throw new ValidationError('本文を入力してください');
        if (mb_strlen($t) > 5000) throw new ValidationError('本文は 5,000 文字以内にしてください');
        return ['type' => 'text', 'text' => $t];
    }

    private static function mediaId(mixed $id): string
    {
        $id = is_string($id) ? $id : '';
        if ($id === '') throw new ValidationError('画像をアップロードしてください');
        if (!preg_match('/^[a-f0-9]{32}$/', $id) || !Db::val('SELECT 1 FROM media WHERE id = ?', [$id])) {
            throw new ValidationError('アップロードされていない画像が指定されています');
        }
        return $id;
    }

    private static function uri(mixed $v, string $what): string
    {
        $v = self::str($v);
        if (!preg_match('#^(https?://|tel:|line://)\S+$#', $v) || mb_strlen($v) > 1000) {
            throw new ValidationError($what . 'は https:// などで始まる URL を入力してください');
        }
        return $v;
    }

    private static function rich(array $b): array
    {
        $layout = (string)($b['layout'] ?? '');
        if (!isset(self::RICH_LAYOUTS[$layout])) throw new ValidationError('リッチメッセージのレイアウトが不正です');
        $ratio = $b['ratio'] ?? null;
        if (!is_numeric($ratio) || $ratio < 0.2 || $ratio > 2) throw new ValidationError('リッチメッセージの画像の縦横比が不正です');
        $alt = self::str($b['altText'] ?? '');
        if ($alt === '') throw new ValidationError('リッチメッセージの代替テキストを入力してください');
        if (mb_strlen($alt) > 400) throw new ValidationError('代替テキストは 400 文字以内にしてください');

        $areas = $b['areas'] ?? null;
        if (!is_array($areas) || count($areas) !== count(self::RICH_LAYOUTS[$layout])) {
            throw new ValidationError('リッチメッセージのエリア数がレイアウトと一致しません');
        }
        $outAreas = [];
        foreach (array_values($areas) as $a) {
            $kind = $a['kind'] ?? '';
            $value = self::str($a['value'] ?? '');
            if (!in_array($kind, ['uri', 'text'], true) || $value === '') {
                throw new ValidationError('リッチメッセージの各エリアにリンクまたはテキストを設定してください');
            }
            if ($kind === 'uri') $value = self::uri($value, 'リッチメッセージのリンク');
            elseif (mb_strlen($value) > 300) throw new ValidationError('エリアのテキストは 300 文字以内にしてください');
            $outAreas[] = ['kind' => $kind, 'value' => $value];
        }
        return [
            'type' => 'rich', 'mediaId' => self::mediaId($b['mediaId'] ?? ''), 'ratio' => (float)$ratio,
            'layout' => $layout, 'areas' => $outAreas, 'altText' => $alt,
        ];
    }

    private static function cards(array $b): array
    {
        $alt = self::str($b['altText'] ?? '');
        if ($alt === '') throw new ValidationError('カードの代替テキストを入力してください');
        if (mb_strlen($alt) > 400) throw new ValidationError('代替テキストは 400 文字以内にしてください');
        $cards = $b['cards'] ?? null;
        if (!is_array($cards) || count($cards) < 1 || count($cards) > self::MAX_CARDS) {
            throw new ValidationError('カードは 1〜' . self::MAX_CARDS . ' 枚で設定してください');
        }
        $out = [];
        foreach (array_values($cards) as $c) {
            $title = self::str($c['title'] ?? '');
            if ($title === '') throw new ValidationError('カードのタイトルを入力してください');
            if (mb_strlen($title) > 40) throw new ValidationError('カードのタイトルは 40 文字以内にしてください');
            $desc = self::str($c['description'] ?? '');
            if (mb_strlen($desc) > 60) throw new ValidationError('カードの説明は 60 文字以内にしてください');
            $buttons = [];
            foreach (array_values(is_array($c['buttons'] ?? null) ? $c['buttons'] : []) as $btn) {
                // 名前もリンクも空のボタン行(画面の初期状態)は無視する
                if (self::str($btn['label'] ?? '') === '' && self::str($btn['uri'] ?? '') === '') continue;
                $label = self::str($btn['label'] ?? '');
                if ($label === '') throw new ValidationError('ボタン名を入力してください');
                if (mb_strlen($label) > 20) throw new ValidationError('ボタン名は 20 文字以内にしてください');
                $buttons[] = ['label' => $label, 'uri' => self::uri($btn['uri'] ?? '', 'ボタンのリンク')];
            }
            if (count($buttons) > self::MAX_BUTTONS) throw new ValidationError('ボタンは 1 枚につき ' . self::MAX_BUTTONS . ' つまでです');
            $card = ['title' => $title, 'description' => $desc, 'buttons' => $buttons];
            $mid = $c['mediaId'] ?? '';
            if (is_string($mid) && $mid !== '') $card['mediaId'] = self::mediaId($mid);
            $out[] = $card;
        }
        return ['type' => 'cards', 'altText' => $alt, 'cards' => $out];
    }

    // ---- LINE 形式への変換 ----

    public static function mediaUrl(string $baseUrl, string $id): string
    {
        return rtrim($baseUrl, '/') . '/media/' . $id;
    }

    /**
     * @param array $blocks validate() 済みのブロック
     * @param ?callable $linkMapper (string $url, string $label): string  リンクの差し替え（クリック計測用）
     */
    public static function build(array $blocks, string $baseUrl, ?callable $linkMapper = null): array
    {
        $messages = [];
        foreach ($blocks as $b) {
            switch ($b['type']) {
                case 'text':
                    $messages[] = ['type' => 'text', 'text' => $b['text']];
                    break;
                case 'image':
                    $u = self::mediaUrl($baseUrl, $b['mediaId']);
                    $messages[] = ['type' => 'image', 'originalContentUrl' => $u, 'previewImageUrl' => $u];
                    break;
                case 'rich':
                    $messages[] = self::buildRich($b, $baseUrl, $linkMapper);
                    break;
                case 'cards':
                    $messages[] = [
                        'type' => 'flex',
                        'altText' => $b['altText'],
                        'contents' => ['type' => 'carousel', 'contents' => array_map(fn($c, $i) => self::bubble($c, $baseUrl, $linkMapper, $i + 1), $b['cards'], array_keys($b['cards']))],
                    ];
                    break;
            }
        }
        return $messages;
    }

    private static function buildRich(array $b, string $baseUrl, ?callable $linkMapper = null): array
    {
        $width = 1040;
        $height = (int)min(2080, max(1, round($width * $b['ratio'])));
        $actions = [];
        foreach (self::RICH_LAYOUTS[$b['layout']] as $i => [$x, $y, $w, $h]) {
            $area = ['x' => (int)round($x * $width), 'y' => (int)round($y * $height), 'width' => (int)round($w * $width), 'height' => (int)round($h * $height)];
            $a = $b['areas'][$i];
            $actions[] = $a['kind'] === 'uri'
                ? ['type' => 'uri', 'linkUri' => $linkMapper ? $linkMapper($a['value'], 'リッチメッセージ ' . ($i + 1) . ' つ目のエリア') : $a['value'], 'area' => $area]
                : ['type' => 'message', 'text' => $a['value'], 'area' => $area];
        }
        return [
            'type' => 'imagemap',
            'baseUrl' => self::mediaUrl($baseUrl, $b['mediaId']), // LINE が末尾に /1040 等を付けて取得する
            'altText' => $b['altText'],
            'baseSize' => ['width' => $width, 'height' => $height],
            'actions' => $actions,
        ];
    }

    private static function bubble(array $c, string $baseUrl, ?callable $linkMapper = null, int $no = 1): array
    {
        $body = [['type' => 'text', 'text' => $c['title'], 'weight' => 'bold', 'size' => 'lg', 'wrap' => true]];
        if ($c['description'] !== '') {
            $body[] = ['type' => 'text', 'text' => $c['description'], 'size' => 'sm', 'color' => '#666666', 'wrap' => true, 'margin' => 'md'];
        }
        $bubble = ['type' => 'bubble', 'body' => ['type' => 'box', 'layout' => 'vertical', 'contents' => $body]];
        if (!empty($c['mediaId'])) {
            $bubble['hero'] = ['type' => 'image', 'url' => self::mediaUrl($baseUrl, $c['mediaId']), 'size' => 'full', 'aspectRatio' => '20:13', 'aspectMode' => 'cover'];
        }
        if ($c['buttons']) {
            $bubble['footer'] = [
                'type' => 'box', 'layout' => 'vertical', 'spacing' => 'sm',
                'contents' => array_map(fn($btn, $i) => [
                    'type' => 'button', 'style' => $i === 0 ? 'primary' : 'secondary', 'height' => 'sm',
                    'action' => ['type' => 'uri', 'label' => $btn['label'], 'uri' => $linkMapper ? $linkMapper($btn['uri'], 'カード' . $no . '「' . $c['title'] . '」のボタン「' . $btn['label'] . '」') : $btn['uri']],
                ], $c['buttons'], array_keys($c['buttons'])),
            ];
        }
        return $bubble;
    }
}
