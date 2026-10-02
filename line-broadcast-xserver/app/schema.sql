-- 接骨院 LINE 一括配信（Xserver 版）スキーマ。MySQL 5.7+ / MariaDB 10.3+、InnoDB、utf8mb4。
-- 日時はすべて UTC で保存し、画面表示時に日本時間へ変換する。

CREATE TABLE IF NOT EXISTS admin_users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(120) NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'operator',
  created_at    DATETIME     NOT NULL,
  UNIQUE KEY uq_admin_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_attempts (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ip           VARCHAR(64)  NOT NULL,
  attempted_at DATETIME     NOT NULL,
  KEY idx_login_ip (ip, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS line_channels (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(120) NOT NULL,
  description    VARCHAR(500) NULL,
  color          VARCHAR(7)   NOT NULL DEFAULT '#06C755',
  access_token   TEXT         NOT NULL,
  channel_secret TEXT         NOT NULL,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     DATETIME     NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS memberships (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  admin_user_id INT UNSIGNED NOT NULL,
  channel_id    INT UNSIGNED NOT NULL,
  created_at    DATETIME     NOT NULL,
  UNIQUE KEY uq_member (admin_user_id, channel_id),
  KEY idx_member_channel (channel_id),
  CONSTRAINT fk_mem_user FOREIGN KEY (admin_user_id) REFERENCES admin_users (id) ON DELETE CASCADE,
  CONSTRAINT fk_mem_channel FOREIGN KEY (channel_id) REFERENCES line_channels (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS friends (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  channel_id      INT UNSIGNED NOT NULL,
  line_user_id    VARCHAR(64)  NOT NULL,
  display_name    VARCHAR(255) NULL,
  picture_url     VARCHAR(1000) NULL,
  status_message  VARCHAR(500) NULL,
  language        VARCHAR(20)  NULL,
  is_following    TINYINT(1)   NOT NULL DEFAULT 1,
  followed_at     DATETIME     NOT NULL,
  unfollowed_at   DATETIME     NULL,
  last_message_at DATETIME     NULL,
  notes           TEXT         NULL,
  UNIQUE KEY uq_friend (channel_id, line_user_id),
  KEY idx_friend_follow (channel_id, is_following),
  CONSTRAINT fk_friend_channel FOREIGN KEY (channel_id) REFERENCES line_channels (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tags (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  channel_id INT UNSIGNED NOT NULL,
  name       VARCHAR(100) NOT NULL,
  color      VARCHAR(7)   NOT NULL DEFAULT '#06C755',
  created_at DATETIME     NOT NULL,
  UNIQUE KEY uq_tag (channel_id, name),
  CONSTRAINT fk_tag_channel FOREIGN KEY (channel_id) REFERENCES line_channels (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS friend_tags (
  friend_id INT UNSIGNED NOT NULL,
  tag_id    INT UNSIGNED NOT NULL,
  added_at  DATETIME     NOT NULL,
  PRIMARY KEY (friend_id, tag_id),
  KEY idx_ft_tag (tag_id),
  CONSTRAINT fk_ft_friend FOREIGN KEY (friend_id) REFERENCES friends (id) ON DELETE CASCADE,
  CONSTRAINT fk_ft_tag FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inbound_messages (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  friend_id       INT UNSIGNED NOT NULL,
  line_message_id VARCHAR(64)  NULL,
  type            VARCHAR(30)  NOT NULL,
  text            TEXT         NULL,
  received_at     DATETIME     NOT NULL,
  KEY idx_inbound (friend_id, received_at),
  CONSTRAINT fk_inbound_friend FOREIGN KEY (friend_id) REFERENCES friends (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 配信（1 回の指示）。選択したアカウントごとに broadcasts へ展開される
CREATE TABLE IF NOT EXISTS campaigns (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title              VARCHAR(120) NOT NULL,
  blocks             LONGTEXT     NOT NULL,
  messages           LONGTEXT     NOT NULL,
  audience_tag_names LONGTEXT     NOT NULL,
  scheduled_at       DATETIME     NULL,
  created_by         INT UNSIGNED NULL,
  created_at         DATETIME     NOT NULL,
  KEY idx_campaign_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- アカウント 1 つ分の配信
CREATE TABLE IF NOT EXISTS broadcasts (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  campaign_id    INT UNSIGNED NOT NULL,
  channel_id     INT UNSIGNED NOT NULL,
  title          VARCHAR(120) NOT NULL,
  messages       LONGTEXT     NOT NULL,
  status         VARCHAR(20)  NOT NULL DEFAULT 'draft',
  target_all     TINYINT(1)   NOT NULL DEFAULT 1,
  scheduled_at   DATETIME     NULL,
  started_at     DATETIME     NULL,
  sent_at        DATETIME     NULL,
  total_targets  INT          NOT NULL DEFAULT 0,
  success_count  INT          NOT NULL DEFAULT 0,
  failure_count  INT          NOT NULL DEFAULT 0,
  error_message  TEXT         NULL,
  created_at     DATETIME     NOT NULL,
  KEY idx_bc_status (status, scheduled_at),
  KEY idx_bc_campaign (campaign_id),
  KEY idx_bc_channel (channel_id, created_at),
  CONSTRAINT fk_bc_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE,
  CONSTRAINT fk_bc_channel FOREIGN KEY (channel_id) REFERENCES line_channels (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS broadcast_tags (
  broadcast_id INT UNSIGNED NOT NULL,
  tag_id       INT UNSIGNED NOT NULL,
  PRIMARY KEY (broadcast_id, tag_id),
  CONSTRAINT fk_bt_bc FOREIGN KEY (broadcast_id) REFERENCES broadcasts (id) ON DELETE CASCADE,
  CONSTRAINT fk_bt_tag FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS scenarios (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  channel_id     INT UNSIGNED NOT NULL,
  name           VARCHAR(120) NOT NULL,
  description    VARCHAR(500) NULL,
  trigger_type   VARCHAR(20)  NOT NULL DEFAULT 'follow',
  trigger_tag_id INT UNSIGNED NULL,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     DATETIME     NOT NULL,
  KEY idx_sc_channel (channel_id),
  CONSTRAINT fk_sc_channel FOREIGN KEY (channel_id) REFERENCES line_channels (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS scenario_steps (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  scenario_id   INT UNSIGNED NOT NULL,
  step_order    INT          NOT NULL,
  delay_minutes INT          NOT NULL DEFAULT 0,
  send_time     VARCHAR(5)   NULL,
  messages      LONGTEXT     NOT NULL,
  blocks        LONGTEXT     NOT NULL,
  UNIQUE KEY uq_step (scenario_id, step_order),
  CONSTRAINT fk_step_sc FOREIGN KEY (scenario_id) REFERENCES scenarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS scenario_runs (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  scenario_id INT UNSIGNED NOT NULL,
  friend_id   INT UNSIGNED NOT NULL,
  started_at  DATETIME     NOT NULL,
  finished_at DATETIME     NULL,
  status      VARCHAR(20)  NOT NULL DEFAULT 'running',
  UNIQUE KEY uq_run (scenario_id, friend_id),
  KEY idx_run_status (status),
  CONSTRAINT fk_run_sc FOREIGN KEY (scenario_id) REFERENCES scenarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_run_friend FOREIGN KEY (friend_id) REFERENCES friends (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS scenario_run_steps (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  run_id        INT UNSIGNED NOT NULL,
  step_id       INT UNSIGNED NOT NULL,
  scheduled_at  DATETIME     NOT NULL,
  started_at    DATETIME     NULL,
  sent_at       DATETIME     NULL,
  status        VARCHAR(20)  NOT NULL DEFAULT 'pending',
  error_message TEXT         NULL,
  KEY idx_rs_due (status, scheduled_at),
  KEY idx_rs_step (step_id, status),
  CONSTRAINT fk_rs_run FOREIGN KEY (run_id) REFERENCES scenario_runs (id) ON DELETE CASCADE,
  CONSTRAINT fk_rs_step FOREIGN KEY (step_id) REFERENCES scenario_steps (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 配信用画像のメタ情報（実ファイルは app/storage/media/ に保存）
CREATE TABLE IF NOT EXISTS media (
  id           CHAR(32)     NOT NULL PRIMARY KEY,
  content_type VARCHAR(50)  NOT NULL,
  width        INT          NULL,
  height       INT          NULL,
  size         INT          NOT NULL,
  created_at   DATETIME     NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
