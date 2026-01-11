-- Migration: Create user_preferences table
-- Description: Stores authenticated user preferences for default settings
--              (theme, language, expiration, etc.)

-- Create user_preferences table
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,

  -- Editor preferences
  editor_theme text default 'dark' check (editor_theme in ('dark', 'light', 'auto')),
  default_language text default 'text',
  default_expiration text default '7d' check (default_expiration in ('1h', '1d', '7d', 'never')),

  -- Feature flags
  enable_ai_analysis boolean default true,
  enable_syntax_highlighting boolean default true,
  enable_line_numbers boolean default true,

  -- Notifications
  notify_on_paste_expiry boolean default false,

  -- Metadata for flexible future settings
  metadata jsonb default '{}'::jsonb,

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.user_preferences enable row level security;

-- RLS Policy: Users can read their own preferences
create policy "Users can view own preferences"
  on public.user_preferences
  for select
  using (auth.uid() = user_id);

-- RLS Policy: Users can insert their own preferences
create policy "Users can insert own preferences"
  on public.user_preferences
  for insert
  with check (auth.uid() = user_id);

-- RLS Policy: Users can update their own preferences
create policy "Users can update own preferences"
  on public.user_preferences
  for update
  using (auth.uid() = user_id);

-- RLS Policy: Users can delete their own preferences
create policy "Users can delete own preferences"
  on public.user_preferences
  for delete
  using (auth.uid() = user_id);

-- Create indexes
create index if not exists idx_user_preferences_updated_at
  on public.user_preferences(updated_at desc);

-- Function to automatically update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Trigger to auto-update updated_at
create trigger user_preferences_updated_at
  before update on public.user_preferences
  for each row
  execute function public.update_updated_at_column();

-- Add comments for documentation
comment on table public.user_preferences is 'Stores authenticated user preferences for default paste settings and UI preferences';
comment on column public.user_preferences.metadata is 'JSONB column for flexible future preference additions';

-- Grant permissions
grant select, insert, update, delete on public.user_preferences to authenticated;
