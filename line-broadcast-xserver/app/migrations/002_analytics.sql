-- 配信分析: リンクのクリック計測（自前）と、LINE の配信統計（開封・クリック）の保存
CREATE TABLE IF NOT EXISTS tracked_links (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT UNSIGNED NOT NULL,
  token       VARCHAR(20)  NOT NULL,
  url         VARCHAR(1000) NOT NULL,
  label       VARCHAR(200) NOT NULL,
  created_at  DATETIME     NOT NULL,
  UNIQUE KEY uq_tl_token (token),
  KEY idx_tl_campaign (campaign_id),
  CONSTRAINT fk_tl_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS link_clicks (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  link_id      INT UNSIGNED NOT NULL,
  visitor_hash CHAR(40)     NOT NULL,
  clicked_at   DATETIME     NOT NULL,
  KEY idx_lc_link (link_id, clicked_at),
  CONSTRAINT fk_lc_link FOREIGN KEY (link_id) REFERENCES tracked_links (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS broadcast_insights (
  broadcast_id INT UNSIGNED NOT NULL PRIMARY KEY,
  request_id   VARCHAR(64)  NULL,
  data         LONGTEXT     NULL,
  fetched_at   DATETIME     NULL,
  CONSTRAINT fk_bi_bc FOREIGN KEY (broadcast_id) REFERENCES broadcasts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
