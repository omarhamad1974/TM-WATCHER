-- Run this once in Supabase: SQL Editor > New query > paste > Run.

create table if not exists public.catalogues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  pdf_path text,
  page_count int,
  mark_count int default 0,
  extract_params jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.trademarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  catalogue_id uuid not null references public.catalogues on delete cascade,
  page int not null,
  idx int not null default 0,
  image_path text not null,
  width int,
  height int
);
create index if not exists trademarks_cat_idx on public.trademarks (catalogue_id, page, idx);

create table if not exists public.searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  catalogue_id uuid references public.catalogues on delete set null,
  source_path text,
  source_name text,
  params jsonb not null,
  min_similarity numeric,
  compared int,
  match_count int,
  created_at timestamptz not null default now()
);

create table if not exists public.search_results (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  search_id uuid not null references public.searches on delete cascade,
  trademark_id uuid not null references public.trademarks on delete cascade,
  score numeric not null,
  metrics jsonb,
  variant text,
  status text not null default 'new' check (status in ('new','cleared','watch','conflict')),
  note text
);
create index if not exists results_search_idx on public.search_results (search_id, score desc);

create table if not exists public.presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  params jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- Row Level Security: every user only ever sees their own rows.
alter table public.catalogues enable row level security;
alter table public.trademarks enable row level security;
alter table public.searches enable row level security;
alter table public.search_results enable row level security;
alter table public.presets enable row level security;

create policy "own catalogues" on public.catalogues for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own trademarks" on public.trademarks for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists
    (select 1 from public.catalogues c where c.id = catalogue_id and c.user_id = auth.uid()));
create policy "own searches" on public.searches for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own results" on public.search_results for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own presets" on public.presets for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Private storage bucket. Files live under "<user id>/..." and only that user can touch them.
insert into storage.buckets (id, name, public) values ('tm', 'tm', false)
on conflict (id) do nothing;

create policy "tm read own" on storage.objects for select to authenticated
  using (bucket_id = 'tm' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "tm insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'tm' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "tm update own" on storage.objects for update to authenticated
  using (bucket_id = 'tm' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "tm delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'tm' and (storage.foldername(name))[1] = auth.uid()::text);
