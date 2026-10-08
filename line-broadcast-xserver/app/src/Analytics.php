<?php
declare(strict_types=1);

/** 配信の分析: 自前のリンククリック計測と、LINE の配信統計（開封・クリック）の取得 */
final class Analytics
{
    /**
     * メッセージ内の https リンクを計測用の短い URL（/r/トークン）に差し替える関数を返す。
     * 差し替えたリンクは $links に溜まるので、キャンペーン作成後に save() で保存する。
     * @param array<string,array{url:string,label:string}> $links
     */
    public static function mapper(array &$links): callable
    {
        return function (string $url, string $label) use (&$links): string {
            if (!preg_match('#^https?://#i', $url)) return $url; // tel: や line:// は計測できない
            $token = bin2hex(random_bytes(6));
            $links[$token] = ['url' => $url, 'label' => mb_substr($label, 0, 200)];
            return public_base_url() . '/r/' . $token;
        };
    }

    public static function save(int $campaignId, array $links): void
    {
        foreach ($links as $token => $l) {
            Db::exec('INSERT INTO tracked_links (campaign_id, token, url, label, created_at) VALUES (?,?,?,?,?)', [$campaignId, $token, $l['url'], $l['label'], now_utc()]);
        }
    }

    /** クリックを記録して、転送先の URL を返す（存在しなければ null） */
    public static function hit(string $token, string $ip, string $ua): ?string
    {
        $link = preg_match('/^[a-f0-9]{12}$/', $token) ? Db::one('SELECT id, url FROM tracked_links WHERE token = ?', [$token]) : null;
        if (!$link) return null;
        // リンクのプレビューを作るボットなどは数えない
        if (!preg_match('/bot|crawl|spider|preview|facebookexternalhit|slurp/i', $ua)) {
            Db::exec('INSERT INTO link_clicks (link_id, visitor_hash, clicked_at) VALUES (?,?,?)', [(int)$link['id'], sha1($ip . '|' . $ua . '|' . $token), now_utc()]);
        }
        return $link['url'];
    }

    /** @return array<int,array{id:int,label:string,url:string,clicks:int,people:int}> */
    public static function linkStats(int $campaignId): array
    {
        return array_map(fn($r) => ['id' => (int)$r['id'], 'label' => $r['label'], 'url' => $r['url'], 'clicks' => (int)$r['clicks'], 'people' => (int)$r['people']],
            Db::all(
                'SELECT t.id, t.label, t.url, COUNT(c.id) AS clicks, COUNT(DISTINCT c.visitor_hash) AS people
                   FROM tracked_links t LEFT JOIN link_clicks c ON c.link_id = t.id
                  WHERE t.campaign_id = ? GROUP BY t.id ORDER BY t.id',
                [$campaignId]
            ));
    }

    /** 日ごとのクリック数（日本時間） @return array<string,int> */
    public static function clicksByDay(int $campaignId): array
    {
        $out = [];
        foreach (Db::all(
            "SELECT DATE(CONVERT_TZ(c.clicked_at, '+00:00', '+09:00')) AS d, COUNT(*) AS n
               FROM link_clicks c JOIN tracked_links t ON t.id = c.link_id WHERE t.campaign_id = ? GROUP BY d ORDER BY d",
            [$campaignId]
        ) as $r) $out[(string)$r['d']] = (int)$r['n'];
        return $out;
    }

    /**
     * LINE から配信統計を取得して保存する（全員配信 = broadcast の配信だけが対象）。
     * @return array{ok:bool,error?:string}
     */
    public static function refreshInsight(int $broadcastId): array
    {
        $row = Db::one('SELECT bi.request_id, b.channel_id FROM broadcast_insights bi JOIN broadcasts b ON b.id = bi.broadcast_id WHERE bi.broadcast_id = ?', [$broadcastId]);
        if (!$row || !$row['request_id']) return ['ok' => false, 'error' => 'この配信には LINE の配信 ID がありません（タグで絞り込んだ配信は、LINE の仕様で統計を取得できません）'];
        $channel = Db::one('SELECT * FROM line_channels WHERE id = ?', [$row['channel_id']]);
        if (!$channel) return ['ok' => false, 'error' => 'アカウントが見つかりません'];
        try {
            $data = Line::insightEvent(Line::token($channel), (string)$row['request_id']);
        } catch (Throwable $e) {
            return ['ok' => false, 'error' => 'LINE から統計を取得できませんでした: ' . $e->getMessage()];
        }
        Db::exec('UPDATE broadcast_insights SET data = ?, fetched_at = ? WHERE broadcast_id = ?', [json_encode($data, JSON_UNESCAPED_UNICODE), now_utc(), $broadcastId]);
        return ['ok' => true];
    }

    /** 保存済みの LINE 統計を、画面表示用に整える。 @return ?array{delivered:?int,impression:?int,click:?int,clicks:array,fetched_at:?string,ready:bool} */
    public static function insightView(?array $row): ?array
    {
        if (!$row || !$row['request_id']) return null;
        $d = $row['data'] ? json_decode((string)$row['data'], true) : null;
        $o = is_array($d) ? ($d['overview'] ?? []) : [];
        return [
            'fetched_at' => $row['fetched_at'],
            'ready' => isset($o['uniqueImpression']) || isset($o['delivered']),
            'delivered' => isset($o['delivered']) ? (int)$o['delivered'] : null,
            'impression' => isset($o['uniqueImpression']) ? (int)$o['uniqueImpression'] : null,
            'click' => isset($o['uniqueClick']) ? (int)$o['uniqueClick'] : null,
            'clicks' => is_array($d['clicks'] ?? null) ? $d['clicks'] : [],
        ];
    }
}
