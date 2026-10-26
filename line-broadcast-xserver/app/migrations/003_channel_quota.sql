-- LINE のメッセージ配信数（月の上限・今月の消費）の控え。cron が定期的に更新する
CREATE TABLE IF NOT EXISTS channel_quota (
  channel_id  INT UNSIGNED NOT NULL PRIMARY KEY,
  limit_type  VARCHAR(10)  NULL,
  limit_value INT          NULL,
  used        INT          NULL,
  error       VARCHAR(255) NULL,
  fetched_at  DATETIME     NOT NULL,
  CONSTRAINT fk_cq_channel FOREIGN KEY (channel_id) REFERENCES line_channels (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
