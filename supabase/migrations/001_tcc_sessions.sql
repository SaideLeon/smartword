-- Tabela de sessões TCC
create table if not exists tcc_sessions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),

  topic       text not null,                         -- tópico inserido pelo utilizador
  outline_draft    text,                             -- esboço gerado para aprovação
  outline_approved text,                             -- âncora: esboço aprovado definitivamente
  sections    jsonb default '[]'::jsonb,             -- array de secções com conteúdo
  status      text default 'outline_pending'         -- outline_pending | outline_approved | in_progress | completed
    check (status in ('outline_pending','outline_approved','in_progress','completed'))
);

-- Trigger para actualizar updated_at automaticamente
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tcc_sessions_updated_at
  before update on tcc_sessions
  for each row execute function update_updated_at();

-- RLS: acesso público anon (adequado para a fase actual)
alter table tcc_sessions enable row level security;

create policy "allow_all_anon" on tcc_sessions
  for all using (true) with check (true);
