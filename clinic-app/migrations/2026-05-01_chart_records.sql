-- ===========================================================================
-- 鍼灸カルテ機能のための新規テーブル
--   chart_records  : 来院 (visits) ごとの施術カルテ。マーカー位置を jsonb で保持。
--   chart_comments : カルテへのスタッフ間スレッド形式コメント。
--
-- 既存スキーマ (visits, patients) には変更なし。
-- ===========================================================================

create table if not exists chart_records (
  id           uuid primary key default gen_random_uuid(),
  visit_id     uuid not null references visits(id) on delete cascade,
  patient_id   uuid not null references patients(id) on delete cascade,
  -- 施術を実施したスタッフのロール ("master" | "main" | "branch")
  recorded_by  text not null,
  -- マーカー配列 (front/back × 6種マーカー × 部位選択)
  -- 例: [{ "view":"front","x":52.3,"y":18.4,"type":"needle" },
  --      { "view":"back","x":47.1,"y":62.8,"type":"muscle","part":"腰方形筋" }]
  markers      jsonb not null default '[]'::jsonb,
  -- スタッフ用フリーメモ (1施術1枚)
  free_note    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 来院1回 = カルテ1枚。upsert を visit_id でできるよう unique を貼る。
create unique index if not exists chart_records_visit_id_uniq
  on chart_records(visit_id);

create index if not exists chart_records_patient_id_idx
  on chart_records(patient_id, created_at desc);

-- ---------------------------------------------------------------------------

create table if not exists chart_comments (
  id           uuid primary key default gen_random_uuid(),
  chart_id     uuid not null references chart_records(id) on delete cascade,
  -- 投稿者のロール ("master" | "main" | "branch")
  author_role  text not null,
  body         text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists chart_comments_chart_id_idx
  on chart_comments(chart_id, created_at asc);

-- ===========================================================================
-- RLS (Row Level Security)
-- 既存の他テーブル同様、サーバー側 (anon key) で操作する想定。
-- 必要に応じて Supabase ダッシュボードで policy を調整してください。
-- ===========================================================================

alter table chart_records enable row level security;
alter table chart_comments enable row level security;

-- 開発中は anon key からの全操作を許可 (本番では絞る想定)
-- PostgreSQL の create policy は if not exists に対応していないため、
-- drop policy if exists を先に実行してから create する。
drop policy if exists "chart_records anon all" on chart_records;
create policy "chart_records anon all"
  on chart_records for all using (true) with check (true);

drop policy if exists "chart_comments anon all" on chart_comments;
create policy "chart_comments anon all"
  on chart_comments for all using (true) with check (true);
