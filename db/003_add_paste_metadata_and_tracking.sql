-- Migration: Add metadata and lightweight tracking to pastes
-- Description: Adds JSONB metadata column for flexible client data and
--              last_viewed_at for basic recency tracking without write amplification

-- Add metadata column for flexible client-provided data
alter table public.pastes
  add column if not exists metadata jsonb default '{}'::jsonb;

-- Add last viewed timestamp for basic analytics
alter table public.pastes
  add column if not exists last_viewed_at timestamptz;

-- Add GIN index for JSONB queries (efficient for metadata searches)
create index if not exists idx_pastes_metadata on public.pastes using gin (metadata);

-- Add index for last_viewed_at (for "recently viewed" queries)
create index if not exists idx_pastes_last_viewed_at on public.pastes(last_viewed_at desc)
  where last_viewed_at is not null;

-- Update the increment_view_count function to also update last_viewed_at
create or replace function public.increment_view_count(paste_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pastes
  set
    view_count = view_count + 1,
    last_viewed_at = now()
  where id = paste_id;
end;
$$;

-- Add comments for documentation
comment on column public.pastes.metadata is 'JSONB column for flexible client metadata (editor settings, tags, etc.)';
comment on column public.pastes.last_viewed_at is 'Timestamp of last view, updated atomically with view_count';

-- Example metadata structure (for documentation):
-- {
--   "clientVersion": "1.0.0",
--   "editorSettings": {
--     "lineNumbers": true,
--     "wordWrap": false,
--     "fontSize": 14
--   },
--   "tags": ["typescript", "tutorial"],
--   "customData": { ... }
-- }
