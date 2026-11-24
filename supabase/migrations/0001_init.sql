-- Not applied anywhere yet. Apply to a TEST project first (separate from live).
create extension if not exists vector;
create extension if not exists pgmq;
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table applications (
  id uuid primary key default gen_random_uuid(),
  company text not null, one_liner text, sector text, stage text,
  form jsonb not null, status text not null default 'ingested',
  lane text, bucket text, rank_score numeric, synthetic boolean not null default true,
  created_at timestamptz not null default now()
);
create table documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications on delete cascade,
  kind text check (kind in ('form','deck')), page int, text text not null
);
create table claims (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications on delete cascade,
  doc_kind text, metric text, value numeric, unit text, period text, quote text not null, page int
);
create table checks (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications on delete cascade,
  severity text check (severity in ('red','warn','info')), name text, formula text, detail text
);
create table gates (
  application_id uuid references applications on delete cascade,
  gate text check (gate in ('G1','G2','G3','G4')), tripped boolean, reason text, citations jsonb,
  primary key (application_id, gate)
);
create table scores (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications on delete cascade,
  criterion text, score numeric, confidence text, claim_ids uuid[], rationale text,
  rubric_version int not null, prompt_version int not null, created_at timestamptz default now()
);
create table config_versions (
  kind text, version int, body jsonb not null, created_at timestamptz default now(), primary key (kind, version)
);
create table portfolio (
  id uuid primary key default gen_random_uuid(),
  name text, one_liner text, sector text, status text check (status in ('active','exited','shut_down')),
  tags text[], source_url text, source_note text, domain text, embedding vector(1536)
);
create table memos (
  id uuid primary key default gen_random_uuid(), company text, outcome text,
  what_it_does text, founder_assessment text, risks text, why text, embedding vector(1536)
);
create table email_drafts (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications on delete cascade,
  template text, subject text, body text, version int default 1,
  offered_slots jsonb, lint jsonb, created_at timestamptz default now()
);
create table style_examples (id uuid primary key default gen_random_uuid(), sector text, founder_type text, body text, source text default 'riya', embedding vector(1536));
create table threads (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications on delete cascade,
  gmail_thread_id text unique, to_email text, state text default 'sent',
  offered_slots jsonb, claimed_by text, claimed_at timestamptz, sent_at timestamptz
);
create table meetings_booked (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references threads, application_id uuid references applications,
  starts_at timestamptz not null, ends_at timestamptz not null, meet_link text, calendar_link text, with_aditya boolean default false
);
create table decisions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications on delete cascade,
  decision text check (decision in ('yes','no')), note text, against_recommendation boolean,
  decided_by text, created_at timestamptz default now()
);
create table jobs (
  id uuid primary key default gen_random_uuid(), application_id uuid references applications on delete cascade,
  step text, attempt int default 0, status text default 'queued', error text, updated_at timestamptz default now()
);
create table llm_calls (
  id bigserial primary key, step text, model text, tokens_in int, tokens_out int, cost_usd numeric,
  latency_ms int, retries int, fell_back boolean, cached boolean, ok boolean, error text, created_at timestamptz default now()
);
create table research_queries (id bigserial primary key, application_id uuid references applications on delete cascade, query text, results int, created_at timestamptz default now());

-- Browser never talks to the DB directly: RLS on, no policies; only the server's service key is used.
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('alter table %I enable row level security', t);
  end loop; end $$;

select pgmq.create('applications');

-- Cron token lives in Vault, generated inside the DB, never in code.
create or replace function check_cron_token(token text) returns boolean
language sql security definer set search_path = public, vault as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'cron_token' and decrypted_secret = token);
$$;
revoke all on function check_cron_token(text) from public, anon, authenticated;
grant execute on function check_cron_token(text) to service_role;
