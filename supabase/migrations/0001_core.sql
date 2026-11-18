-- PathWise Milestone 1: profiles, questionnaire, roadmap templates, journeys, tasks, activity.
create extension if not exists pgcrypto;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- profiles ------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text check (char_length(full_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- questionnaire_responses (typed columns so rules stay deterministic) ---------
create table public.questionnaire_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  country_of_residence text not null check (char_length(country_of_residence) between 2 and 80),
  citizenship text not null check (char_length(citizenship) between 2 and 80),
  education_status text not null check (education_status in ('current_student','recent_graduate','graduate_with_experience')),
  experience_level text not null check (experience_level in ('none','under_1_year','1_to_3_years','3_plus_years')),
  career_field text not null check (career_field in ('marketing','hospitality','technology','business','design','other')),
  program_category text not null check (program_category in ('intern','trainee')),
  destination_city text not null check (destination_city in ('Miami','Orlando','New York City','Chicago','Los Angeles')),
  duration_months int not null check (duration_months in (3,6,9,12)),
  budget_range text not null check (budget_range in ('under_8000','8000_to_12000','12000_plus')),
  has_host boolean not null,
  has_agency_quote boolean not null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger questionnaire_updated before update on public.questionnaire_responses for each row execute function public.set_updated_at();

-- roadmap templates (public, read-only to users) ------------------------------
create table public.roadmap_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  version int not null check (version > 0),
  title text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (key, version)
);
create table public.roadmap_template_tasks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.roadmap_templates(id) on delete cascade,
  key text not null,
  section text not null check (section in ('profile_eligibility','employer_journey','sponsor_journey','document_preparation','visa_application','arrival_relocation')),
  title text not null,
  description text not null default '',
  position int not null,
  requires_evidence boolean not null default false,
  external_verification boolean not null default false,
  auto_complete boolean not null default false,
  applies_when jsonb not null default '{}'::jsonb,   -- e.g. {"has_host": false}
  depends_on text[] not null default '{}',           -- keys of tasks in the same template
  unique (template_id, key)
);

-- journeys and journey_tasks (user-owned) -------------------------------------
create table public.journeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  questionnaire_id uuid references public.questionnaire_responses(id) on delete set null,
  template_id uuid not null references public.roadmap_templates(id),
  destination_city text not null,
  intended_category text not null check (intended_category in ('intern','trainee')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger journeys_updated before update on public.journeys for each row execute function public.set_updated_at();

create table public.journey_tasks (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.journeys(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  template_task_id uuid references public.roadmap_template_tasks(id) on delete set null,
  template_task_key text not null,
  section text not null,
  title text not null,
  description text not null default '',
  position int not null,
  status text not null default 'not_started' check (status in ('not_started','in_progress','ready_for_review','awaiting_external_confirmation','completed')),
  requires_evidence boolean not null default false,
  external_verification boolean not null default false,
  is_applicable boolean not null default true,
  depends_on text[] not null default '{}',
  notes text not null default '' check (char_length(notes) <= 2000),
  evidence_note text not null default '' check (char_length(evidence_note) <= 2000),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (journey_id, template_task_key)
);
create index journey_tasks_journey_idx on public.journey_tasks (journey_id, position);
create index journey_tasks_user_idx on public.journey_tasks (user_id);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  journey_id uuid references public.journeys(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_events_user_idx on public.activity_events (user_id, created_at desc);

-- business rules enforced in the database ------------------------------------
create or replace function public.journey_tasks_rules() returns trigger language plpgsql set search_path = '' as $$
declare blocking text;
begin
  if new.status is distinct from old.status then
    if not old.is_applicable then
      raise exception 'This step does not apply to your situation.';
    end if;
    if new.status = 'completed' then
      if new.external_verification and current_user in ('authenticated','anon') then
        raise exception 'This step must be confirmed by your sponsor, a government office, or another third party. Mark it as awaiting confirmation instead.';
      end if;
      if new.requires_evidence and btrim(new.evidence_note) = '' then
        raise exception 'Add evidence (a link, reference number, or short note) before completing this task.';
      end if;
      select string_agg(d.title, ', ') into blocking from public.journey_tasks d
        where d.journey_id = new.journey_id and d.is_applicable
          and d.template_task_key = any (new.depends_on) and d.status <> 'completed';
      if blocking is not null then
        raise exception 'Complete these steps first: %', blocking;
      end if;
      new.completed_at := now();
    else
      new.completed_at := null;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger journey_tasks_rules before update on public.journey_tasks for each row execute function public.journey_tasks_rules();

create or replace function public.log_task_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    insert into public.activity_events (user_id, journey_id, event_type, payload)
    values (new.user_id, new.journey_id, 'task_status_changed',
      jsonb_build_object('task_key', new.template_task_key, 'from', old.status, 'to', new.status));
  end if;
  return new;
end $$;
revoke all on function public.log_task_change() from public, anon, authenticated;
create trigger journey_tasks_log after update on public.journey_tasks for each row execute function public.log_task_change();

-- deterministic roadmap rules --------------------------------------------------
create or replace function public.task_applies(rule jsonb, q public.questionnaire_responses) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce((rule->>'has_host')::boolean = q.has_host, true)
     and coalesce(rule->>'program_category' = q.program_category, true)
     and coalesce((rule->>'has_agency_quote')::boolean = q.has_agency_quote, true)
$$;

-- creates the journey, or re-syncs it after answers change, without deleting progress
create or replace function public.upsert_journey() returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); q public.questionnaire_responses; t public.roadmap_templates; j public.journeys;
begin
  if uid is null then raise exception 'You must be signed in.' using errcode = '28000'; end if;
  select * into q from public.questionnaire_responses where user_id = uid;
  if not found then raise exception 'Complete the questionnaire first.'; end if;
  select * into t from public.roadmap_templates where active order by version desc limit 1;
  if not found then raise exception 'No active roadmap template.'; end if;

  insert into public.journeys (user_id, questionnaire_id, template_id, destination_city, intended_category)
  values (uid, q.id, t.id, q.destination_city, q.program_category)
  on conflict (user_id) do update
    set questionnaire_id = excluded.questionnaire_id, destination_city = excluded.destination_city,
        intended_category = excluded.intended_category
  returning * into j;

  insert into public.journey_tasks (journey_id, user_id, template_task_id, template_task_key, section, title, description,
      position, status, requires_evidence, external_verification, is_applicable, depends_on, completed_at)
  select j.id, uid, tt.id, tt.key, tt.section, tt.title, tt.description, tt.position,
      case when tt.auto_complete then 'completed' else 'not_started' end,
      tt.requires_evidence, tt.external_verification, public.task_applies(tt.applies_when, q), tt.depends_on,
      case when tt.auto_complete then now() end
  from public.roadmap_template_tasks tt where tt.template_id = j.template_id
  on conflict (journey_id, template_task_key) do nothing;

  update public.journey_tasks jt set is_applicable = public.task_applies(tt.applies_when, q)
  from public.roadmap_template_tasks tt
  where jt.journey_id = j.id and tt.id = jt.template_task_id and jt.status = 'not_started';

  insert into public.activity_events (user_id, journey_id, event_type) values (uid, j.id, 'journey_synced');
  return j.id;
end $$;
revoke all on function public.upsert_journey() from public, anon;
grant execute on function public.upsert_journey() to authenticated;

-- Row Level Security -----------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.questionnaire_responses enable row level security;
alter table public.roadmap_templates enable row level security;
alter table public.roadmap_template_tasks enable row level security;
alter table public.journeys enable row level security;
alter table public.journey_tasks enable row level security;
alter table public.activity_events enable row level security;

create policy profiles_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy q_select on public.questionnaire_responses for select to authenticated using (user_id = (select auth.uid()));
create policy q_insert on public.questionnaire_responses for insert to authenticated with check (user_id = (select auth.uid()));
create policy q_update on public.questionnaire_responses for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy templates_read on public.roadmap_templates for select to authenticated using (true);
create policy template_tasks_read on public.roadmap_template_tasks for select to authenticated using (true);
create policy journeys_select on public.journeys for select to authenticated using (user_id = (select auth.uid()));
create policy tasks_select on public.journey_tasks for select to authenticated using (user_id = (select auth.uid()));
create policy tasks_update on public.journey_tasks for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy events_select on public.activity_events for select to authenticated using (user_id = (select auth.uid()));

-- Table privileges: least privilege. Journeys/tasks are created only by upsert_journey().
revoke all on all tables in schema public from anon;
revoke all on public.profiles, public.questionnaire_responses, public.roadmap_templates, public.roadmap_template_tasks,
  public.journeys, public.journey_tasks, public.activity_events from authenticated;
grant select on public.profiles, public.roadmap_templates, public.roadmap_template_tasks, public.journeys,
  public.journey_tasks, public.activity_events, public.questionnaire_responses to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant insert, update on public.questionnaire_responses to authenticated;
grant update (status, notes, evidence_note) on public.journey_tasks to authenticated;
