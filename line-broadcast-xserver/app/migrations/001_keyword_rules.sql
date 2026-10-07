-- キーワード自動タグ付け: 友だちが送ったメッセージが一致したら、タグを付ける（任意で自動返信）
CREATE TABLE IF NOT EXISTS keyword_rules (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  channel_id  INT UNSIGNED NOT NULL,
  keyword     VARCHAR(100) NOT NULL,
  match_type  VARCHAR(10)  NOT NULL DEFAULT 'exact',
  tag_id      INT UNSIGNED NOT NULL,
  reply_text  VARCHAR(500) NULL,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL,
  KEY idx_kw_channel (channel_id, is_active),
  CONSTRAINT fk_kw_channel FOREIGN KEY (channel_id) REFERENCES line_channels (id) ON DELETE CASCADE,
  CONSTRAINT fk_kw_tag FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
