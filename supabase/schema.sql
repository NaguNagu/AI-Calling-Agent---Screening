-- Vaani screening MVP database
-- This first version is for your internal team. All tables require login.

create extension if not exists "pgcrypto";

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  jd_text text,
  job_location text,
  interview_mode text check (interview_mode in ('face_to_face', 'virtual', 'both')) default 'both',
  company_name text,
  company_disclosure text check (company_disclosure in ('always', 'if_asked', 'never')) default 'if_asked',
  caller_name text default 'Anitha',
  languages text[] not null default array['English', 'Tamil', 'Hindi'],
  max_call_attempts integer not null default 2 check (max_call_attempts between 1 and 5),
  preferred_call_start time,
  preferred_call_end time,
  status text not null default 'draft' check (status in ('draft', 'ready', 'active', 'completed', 'paused')),
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete set null,
  full_name text not null,
  mobile_number text not null,
  status text not null default 'not_contacted' check (status in ('not_contacted', 'scheduled', 'calling', 'completed', 'no_answer', 'failed', 'screening_incomplete', 'under_review', 'shortlisted', 'rejected', 'contact_later')),
  preferred_language text check (preferred_language in ('English', 'Tamil', 'Hindi')),
  interview_availability text,
  interview_type text,
  last_working_day date,
  notice_period text,
  reason_for_job_change text,
  ai_summary text,
  recruiter_decision text check (recruiter_decision in ('shortlisted', 'rejected', 'needs_review', 'contact_later')),
  recruiter_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Allow individual contacts that are not assigned to a campaign.
alter table public.candidates alter column campaign_id drop not null;

create table if not exists public.screening_questions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  question_text text not null,
  required boolean not null default false,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  provider text,
  provider_call_id text,
  status text not null default 'queued' check (status in ('queued', 'ringing', 'in_progress', 'completed', 'no_answer', 'busy', 'failed')),
  language text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  recording_url text,
  transcript text,
  ai_summary text,
  failure_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.candidate_answers (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  question_id uuid references public.screening_questions(id) on delete set null,
  question_text text not null,
  answer_text text,
  answer_status text not null default 'answered' check (answer_status in ('answered', 'not_answered', 'unclear')),
  created_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete set null,
  call_id uuid references public.calls(id) on delete set null,
  provider text,
  minutes numeric(10, 2) not null default 0,
  estimated_cost numeric(10, 2),
  created_at timestamptz not null default now()
);

create index if not exists candidates_campaign_id_idx on public.candidates(campaign_id);
create index if not exists screening_questions_campaign_id_idx on public.screening_questions(campaign_id);
create index if not exists calls_candidate_id_idx on public.calls(candidate_id);
create index if not exists usage_events_created_at_idx on public.usage_events(created_at);

-- Protect every table from unauthenticated access.
alter table public.campaigns enable row level security;
alter table public.candidates enable row level security;
alter table public.screening_questions enable row level security;
alter table public.calls enable row level security;
alter table public.candidate_answers enable row level security;
alter table public.usage_events enable row level security;

-- Internal MVP policy: signed-in team members can work with the shared workspace.
-- We will replace this with workspace-level policies before SaaS customer onboarding.
drop policy if exists "signed in team can manage campaigns" on public.campaigns;
create policy "signed in team can manage campaigns" on public.campaigns for all to authenticated using (true) with check (true);

drop policy if exists "signed in team can manage candidates" on public.candidates;
create policy "signed in team can manage candidates" on public.candidates for all to authenticated using (true) with check (true);

drop policy if exists "signed in team can manage questions" on public.screening_questions;
create policy "signed in team can manage questions" on public.screening_questions for all to authenticated using (true) with check (true);

drop policy if exists "signed in team can manage calls" on public.calls;
create policy "signed in team can manage calls" on public.calls for all to authenticated using (true) with check (true);

drop policy if exists "signed in team can manage answers" on public.candidate_answers;
create policy "signed in team can manage answers" on public.candidate_answers for all to authenticated using (true) with check (true);

drop policy if exists "signed in team can manage usage" on public.usage_events;
create policy "signed in team can manage usage" on public.usage_events for all to authenticated using (true) with check (true);
