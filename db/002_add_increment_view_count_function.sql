-- Migration: Add increment_view_count function for atomic view counter
-- Description: Provides atomic increment operation to prevent race conditions
--              when multiple users view the same paste simultaneously

-- Create function to atomically increment view count
create or replace function public.increment_view_count(paste_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pastes
  set view_count = view_count + 1
  where id = paste_id;
end;
$$;

-- Grant execute permission to service_role
grant execute on function public.increment_view_count(bigint) to service_role;

-- Grant execute permission to authenticated users
grant execute on function public.increment_view_count(bigint) to authenticated;

-- Grant execute permission to anonymous users (for public paste views)
grant execute on function public.increment_view_count(bigint) to anon;

-- Add comment for documentation
comment on function public.increment_view_count(bigint) is 'Atomically increments the view count for a paste. Prevents race conditions during concurrent views.';
