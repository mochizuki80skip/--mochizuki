-- =====================================================================
-- ONE'S BODY 自動返信ツール - Supabase スキーマ
--
-- 適用方法:
--   1. Supabase のプロジェクト Dashboard > SQL Editor を開く
--   2. このファイルの内容を貼り付けて Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 拡張機能
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 2. テーブル定義
-- ---------------------------------------------------------------------

-- お客様
create table if not exists public.customers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  goal          text,                       -- 目標 (ボディメイク方向性等)
  tone_memo     text,                       -- 距離感メモ (例「丁寧め・絵文字少なめ」)
  tone_analysis jsonb,                      -- AIが自動分析したトーン情報 (Week 3)
  staff_id      uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists customers_name_idx on public.customers (name);
create index if not exists customers_staff_idx on public.customers (staff_id);

-- お約束 (歩数 5000 歩 / 水 2L 等。1人で複数持てる)
create table if not exists public.promises (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  title       text not null,                -- 例「歩数 5000 歩」「水 2L」
  unit        text,                          -- 例「歩」「L」「回」(任意)
  target      numeric,                       -- 例 5000, 2 (任意)
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists promises_customer_idx on public.promises (customer_id);

-- 報告ログ (お客様からの報告 + 採用したスタッフ返信)
create table if not exists public.reports (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.customers(id) on delete cascade,
  report_date     date not null default current_date,
  -- 達成状況 (JSON: [{ promise_id, status, value }])
  achievements    jsonb not null default '[]'::jsonb,
  customer_msg    text,                      -- お客様コメント原文
  staff_reply     text,                      -- 採用したスタッフ返信
  tone_used       text,                      -- 使ったトーン (例 normal/encourage/praise)
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists reports_customer_date_idx on public.reports (customer_id, report_date desc);

-- ---------------------------------------------------------------------
-- 3. updated_at 自動更新トリガー
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. Row Level Security (RLS)
--
-- 方針: ログイン済みスタッフは全てのお客様データを閲覧・編集可能。
--       (店舗スタッフ数名のチーム運用前提)
--       将来「担当外は閲覧のみ」等が必要になったらここを絞る。
-- ---------------------------------------------------------------------
alter table public.customers enable row level security;
alter table public.promises  enable row level security;
alter table public.reports   enable row level security;

drop policy if exists "auth users full access" on public.customers;
create policy "auth users full access" on public.customers
  for all to authenticated using (true) with check (true);

drop policy if exists "auth users full access" on public.promises;
create policy "auth users full access" on public.promises
  for all to authenticated using (true) with check (true);

drop policy if exists "auth users full access" on public.reports;
create policy "auth users full access" on public.reports
  for all to authenticated using (true) with check (true);
