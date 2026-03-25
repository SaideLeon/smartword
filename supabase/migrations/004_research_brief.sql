alter table tcc_sessions
  add column if not exists research_keywords jsonb,
  add column if not exists research_brief text,
  add column if not exists research_generated_at timestamptz;

alter table work_sessions
  add column if not exists research_keywords jsonb,
  add column if not exists research_brief text,
  add column if not exists research_generated_at timestamptz;
