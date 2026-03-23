create table if not exists work_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  topic text not null,
  outline_draft text,
  outline_approved text,
  sections jsonb default '[]'::jsonb,
  status text default 'outline_pending'
    check (status in ('outline_pending','outline_approved','in_progress','completed'))
);

create trigger work_sessions_updated_at
  before update on work_sessions
  for each row execute function update_updated_at();

alter table work_sessions enable row level security;

create policy "allow_all_anon_work" on work_sessions
  for all using (true) with check (true);
