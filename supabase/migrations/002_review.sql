-- Phase 1: review status and notes on saved matches. Run once on an existing project.
alter table public.search_results
  add column if not exists status text not null default 'new' check (status in ('new','cleared','watch','conflict')),
  add column if not exists note text;
