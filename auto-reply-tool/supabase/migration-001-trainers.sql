-- =====================================================================
-- ONE'S BODY 返信アシスタント - Migration 001
-- Week 3 強化: トレーナー個性 / 会話の繋がり / お約束・お客様の背景
--
-- 適用方法:
--   Supabase Dashboard > SQL Editor > New query
--   このファイルの中身を貼り付けて Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- A. トレーナープロフィール (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.trainers (
  id                       uuid primary key references auth.users(id) on delete cascade,
  display_name             text not null,
  personality_memo         text,
  characteristic_phrases   text,   -- 改行区切りで複数フレーズ
  signature_emoji          text,   -- 空白区切りで複数絵文字
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table public.trainers enable row level security;

drop policy if exists "auth users full access" on public.trainers;
create policy "auth users full access" on public.trainers
  for all to authenticated using (true) with check (true);

drop trigger if exists trg_trainers_updated_at on public.trainers;
create trigger trg_trainers_updated_at
  before update on public.trainers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- D. お客様: 背景ノート
-- ---------------------------------------------------------------------
alter table public.customers
  add column if not exists notes text;

-- ---------------------------------------------------------------------
-- C. お約束: 背景メモ + 開始日
-- ---------------------------------------------------------------------
alter table public.promises
  add column if not exists notes      text,
  add column if not exists started_at date;
