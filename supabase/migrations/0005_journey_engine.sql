-- PathWise Milestone 2.5 (additive): dynamic journey engine.
-- Adds columns and tables only. Deletes nothing, resets nothing. Run once, after 0001-0004.
-- Principle: applicants can record claims and evidence; only confirmed external_facts (set by an admin
-- in the SQL editor, never from the browser) can complete an official milestone.

-- 1. Extra answers --------------------------------------------------------------------------------
alter table public.questionnaire_responses
  add column if not exists host_state text not null default 'none' check (host_state in ('none','interested','offer')),
  add column if not exists host_evidence_note text not null default '' check (char_length(host_evidence_note) <= 2000),
  add column if not exists sponsor_state text not null default 'none' check (sponsor_state in ('none','applied','accepted')),
  add column if not exists service_level text not null default 'self' check (service_level in ('self','assisted_waitlist'));
-- keep existing answers meaningful: an old "I have a host" answer becomes "interested" (never "offer")
update public.questionnaire_responses set host_state = 'interested' where has_host and host_state = 'none';

-- 2. Stage metadata for the map ---------------------------------------------------------------------
create table if not exists public.roadmap_stages (
  section text primary key check (section in ('profile_eligibility','employer_journey','sponsor_journey','document_preparation','visa_application','arrival_relocation')),
  label text not null,
  branch text not null check (branch in ('main','employer','sponsor')),
  position int not null,
  map_x int not null check (map_x between 0 and 100),
  map_y int not null check (map_y between 0 and 100)
);
insert into public.roadmap_stages (section, label, branch, position, map_x, map_y) values
  ('profile_eligibility','Profile & Eligibility','main',1,50,8),
  ('employer_journey','Employer Journey','employer',2,25,30),
  ('sponsor_journey','Sponsor Journey','sponsor',2,75,30),
  ('document_preparation','Document Preparation','main',3,50,52),
  ('visa_application','Visa Application','main',4,50,72),
  ('arrival_relocation','Arrival & Relocation','main',5,50,92)
on conflict (section) do nothing;

-- 3. Who acts on a task ---------------------------------------------------------------------------
alter table public.roadmap_template_tasks add column if not exists responsibility text not null default 'applicant'
  check (responsibility in ('applicant','host','sponsor','government'));
alter table public.journey_tasks add column if not exists responsibility text not null default 'applicant'
  check (responsibility in ('applicant','host','sponsor','government'));
alter table public.roadmap_template_tasks add column if not exists action_href text;
alter table public.journey_tasks add column if not exists action_href text;

-- 4. Rule evaluator (fail closed on unknown keys) --------------------------------------------------------
create or replace function public.engine_applies(rule jsonb, q public.questionnaire_responses) returns boolean
language plpgsql immutable set search_path = '' as $$
declare k text; v jsonb;
begin
  if rule is null or rule = '{}'::jsonb then return true; end if;
  for k, v in select * from jsonb_each(rule) loop
    if k = 'retired' then
      if v = 'true'::jsonb then return false; end if;
    elsif k = 'has_host' then
      if (v #>> '{}')::boolean is distinct from q.has_host then return false; end if;
    elsif k = 'program_category' then
      if (v #>> '{}') is distinct from q.program_category then return false; end if;
    elsif k = 'has_agency_quote' then
      if (v #>> '{}')::boolean is distinct from q.has_agency_quote then return false; end if;
    elsif k = 'host_state' then
      if not (v ? q.host_state) then return false; end if;
    elsif k = 'sponsor_state' then
      if not (v ? q.sponsor_state) then return false; end if;
    else
      return false;  -- unknown rule key: hide the task rather than guess
    end if;
  end loop;
  return true;
end $$;

-- 5. Relax the M1 task trigger for SYSTEM updates only -----------------------------------------------------
-- Applicants (authenticated role) keep every M1 restriction. System code (triggers, admin SQL) may record
-- external confirmations without being blocked by evidence/dependency checks.
create or replace function public.journey_tasks_rules() returns trigger language plpgsql set search_path = '' as $$
declare blocking text; applicant boolean := current_user in ('authenticated','anon');
begin
  if new.status is distinct from old.status then
    if not old.is_applicable then
      raise exception 'This step does not apply to your situation.';
    end if;
    if new.status = 'completed' then
      if applicant then
        if new.external_verification then
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
      end if;
      new.completed_at := now();
    else
      new.completed_at := null;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- audit trail now records who acted
create or replace function public.log_task_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    insert into public.activity_events (user_id, journey_id, event_type, payload)
    values (new.user_id, new.journey_id, 'task_status_changed',
      jsonb_build_object('task_key', new.template_task_key, 'from', old.status, 'to', new.status,
        'actor', case when current_user in ('authenticated','anon') then 'applicant' else 'system' end));
  end if;
  return new;
end $$;

-- 6. Sample opportunities (labelled; never presented as real) --------------------------------------------------
create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 160),
  company_name text not null check (char_length(company_name) between 2 and 120),
  city text not null check (city in ('Miami','Orlando','New York City','Chicago','Los Angeles')),
  career_field text not null check (career_field in ('marketing','hospitality','technology','business','design','other')),
  description text not null default '' check (char_length(description) <= 2000),
  is_sample boolean not null default true,
  source_label text not null default 'SAMPLE: fictional listing for product preview',
  j1_status text not null default 'unverified' check (j1_status in ('confirmed_j1','previous_j1_participation','unverified')),
  j1_evidence_url text,
  created_at timestamptz not null default now(),
  check (j1_status = 'unverified' or (j1_evidence_url is not null and btrim(j1_evidence_url) <> ''))
);
create index if not exists opportunities_city_idx on public.opportunities (city, career_field);

-- 7. Applications (applicant-reported) ----------------------------------------------------------------------------
create table if not exists public.employer_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  journey_id uuid not null references public.journeys(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  status text not null default 'saved' check (status in ('saved','preparing','submitted','responded','interview','offer_received','declined','withdrawn')),
  notes text not null default '' check (char_length(notes) <= 2000),
  evidence_note text not null default '' check (char_length(evidence_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (journey_id, opportunity_id),
  -- anything after "preparing" must point to evidence the applicant can show (sent email, reply, offer letter)
  check (status in ('saved','preparing','declined','withdrawn') or btrim(evidence_note) <> '')
);
create index if not exists employer_applications_user_idx on public.employer_applications (user_id, status);
create trigger employer_applications_updated before update on public.employer_applications for each row execute function public.set_updated_at();

create table if not exists public.opportunity_dismissals (
  user_id uuid not null references public.profiles(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, opportunity_id)
);

-- 8. Resume choice, onboarding drafts -------------------------------------------------------------------------------
create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('uploaded','built')),
  file_path text,
  file_name text check (char_length(file_name) <= 200),
  built_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'uploaded' and file_path is not null) or (kind = 'built' and built_data is not null))
);
create trigger resumes_updated before update on public.resumes for each row execute function public.set_updated_at();

create table if not exists public.journey_state (
  journey_id uuid primary key references public.journeys(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  resume_choice text check (resume_choice in ('uploaded','built','skipped')),
  updated_at timestamptz not null default now()
);
create trigger journey_state_updated before update on public.journey_state for each row execute function public.set_updated_at();

create table if not exists public.onboarding_drafts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb check (pg_column_size(answers) < 20000),
  step_key text check (char_length(step_key) <= 60),
  updated_at timestamptz not null default now()
);
create trigger onboarding_drafts_updated before update on public.onboarding_drafts for each row execute function public.set_updated_at();

-- 9. External facts: claims by applicants, confirmation only by an administrator ----------------------------------------------
create table if not exists public.external_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  journey_id uuid not null references public.journeys(id) on delete cascade,
  fact_type text not null check (fact_type in ('confirm_category_with_sponsor','sponsor_accepts_application','sponsor_reviews_host','sponsor_issues_documents','visa_decision')),
  status text not null default 'claimed' check (status in ('claimed','confirmed','rejected')),
  evidence_note text not null check (char_length(btrim(evidence_note)) between 3 and 2000),
  claimed_at timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by text
);
create unique index if not exists external_facts_one_open on public.external_facts (journey_id, fact_type) where status <> 'rejected';

-- 10. Engine primitives ---------------------------------------------------------------------------------------------------------
create or replace function public.engine_rank(s text) returns int language sql immutable set search_path = '' as $$
  select case s when 'not_started' then 0 when 'in_progress' then 1 when 'ready_for_review' then 2
                when 'awaiting_external_confirmation' then 3 when 'completed' then 4 else 0 end $$;

-- Moves a task FORWARD only; never regresses started work; never touches inapplicable tasks.
create or replace function public.engine_set_task(p_journey uuid, p_key text, p_status text, p_evidence text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.journey_tasks
     set status = p_status,
         evidence_note = case when btrim(coalesce(evidence_note,'')) = '' and p_evidence is not null then p_evidence else evidence_note end
   where journey_id = p_journey and template_task_key = p_key and is_applicable
     and public.engine_rank(p_status) > public.engine_rank(status);
end $$;
revoke all on function public.engine_set_task(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.engine_sync_employer(p_journey uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare ev text;
begin
  if exists (select 1 from public.employer_applications where journey_id = p_journey) then
    perform public.engine_set_task(p_journey, 'define_target_roles', 'in_progress');
    perform public.engine_set_task(p_journey, 'save_first_opportunity', 'completed');
  end if;
  select evidence_note into ev from public.employer_applications
   where journey_id = p_journey and status in ('submitted','responded','interview','offer_received') and btrim(evidence_note) <> ''
   order by updated_at limit 1;
  if found then perform public.engine_set_task(p_journey, 'submit_first_application', 'completed', ev); end if;
  -- a reply is a conversation, never a host
  if exists (select 1 from public.employer_applications where journey_id = p_journey and status in ('responded','interview','offer_received')) then
    perform public.engine_set_task(p_journey, 'employer_replied', 'completed');
  end if;
  -- an offer is "host identified, subject to sponsor verification"; it never touches sponsor tasks
  select evidence_note into ev from public.employer_applications where journey_id = p_journey and status = 'offer_received' order by updated_at limit 1;
  if found then
    perform public.engine_set_task(p_journey, 'record_host_details', 'in_progress');
    perform public.engine_set_task(p_journey, 'host_offer_received', 'completed', ev);
  end if;
end $$;
revoke all on function public.engine_sync_employer(uuid) from public, anon, authenticated;

create or replace function public.engine_sync_sponsors(p_journey uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.journey_sponsor_options where journey_id = p_journey) then
    perform public.engine_set_task(p_journey, 'research_sponsors', 'in_progress');
    perform public.engine_set_task(p_journey, 'shortlist_sponsors', 'completed');
  end if;
  -- choosing a preferred sponsor records a selection only; sponsor acceptance is an external fact
  if exists (select 1 from public.journey_sponsor_options where journey_id = p_journey and status = 'preferred') then
    perform public.engine_set_task(p_journey, 'choose_preferred_sponsor', 'completed');
  end if;
end $$;
revoke all on function public.engine_sync_sponsors(uuid) from public, anon, authenticated;

create or replace function public.engine_on_application() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.engine_sync_employer(new.journey_id);
  insert into public.activity_events (user_id, journey_id, event_type, payload)
    values (new.user_id, new.journey_id, 'application_' || tg_op, jsonb_build_object('status', new.status, 'opportunity_id', new.opportunity_id));
  return new;
end $$;
revoke all on function public.engine_on_application() from public, anon, authenticated;
create trigger employer_applications_engine after insert or update of status on public.employer_applications
  for each row execute function public.engine_on_application();

create or replace function public.engine_on_sponsor_option() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.engine_sync_sponsors(coalesce(new.journey_id, old.journey_id));
  return coalesce(new, old);
end $$;
revoke all on function public.engine_on_sponsor_option() from public, anon, authenticated;
create trigger journey_sponsor_options_engine after insert or update of status on public.journey_sponsor_options
  for each row execute function public.engine_on_sponsor_option();

-- a claim only moves the task to "awaiting"; a confirmation completes it; a rejection reopens it
create or replace function public.engine_on_fact() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.engine_set_task(new.journey_id, new.fact_type, 'awaiting_external_confirmation', new.evidence_note);
    insert into public.activity_events (user_id, journey_id, event_type, payload)
      values (new.user_id, new.journey_id, 'external_fact_claimed', jsonb_build_object('fact_type', new.fact_type));
  elsif new.status is distinct from old.status then
    if new.status = 'confirmed' then
      new.confirmed_at := coalesce(new.confirmed_at, now());
      update public.journey_tasks set status = 'completed', evidence_note = case when btrim(evidence_note) = '' then new.evidence_note else evidence_note end
       where journey_id = new.journey_id and template_task_key = new.fact_type and is_applicable;
    elsif new.status = 'rejected' then
      update public.journey_tasks set status = 'in_progress'
       where journey_id = new.journey_id and template_task_key = new.fact_type and status = 'awaiting_external_confirmation';
    end if;
    insert into public.activity_events (user_id, journey_id, event_type, payload)
      values (new.user_id, new.journey_id, 'external_fact_' || new.status, jsonb_build_object('fact_type', new.fact_type, 'confirmed_by', new.confirmed_by));
  end if;
  return new;
end $$;
revoke all on function public.engine_on_fact() from public, anon, authenticated;
create trigger external_facts_engine_ins after insert on public.external_facts for each row execute function public.engine_on_fact();
create trigger external_facts_engine_upd before update on public.external_facts for each row execute function public.engine_on_fact();

-- saving a resume completes "prepare your CV" (a preparation step, not an official one)
create or replace function public.engine_on_resume() returns trigger language plpgsql security definer set search_path = '' as $$
declare j uuid;
begin
  select id into j from public.journeys where user_id = new.user_id;
  if j is not null then
    perform public.engine_set_task(j, 'prepare_cv', 'completed', 'Resume ' || new.kind || ' in PathWise');
    insert into public.journey_state (journey_id, user_id, resume_choice) values (j, new.user_id, new.kind)
      on conflict (journey_id) do update set resume_choice = excluded.resume_choice;
  end if;
  return new;
end $$;
revoke all on function public.engine_on_resume() from public, anon, authenticated;
create trigger resumes_engine after insert or update on public.resumes for each row execute function public.engine_on_resume();

-- 11. Template -> journey refresh (adds missing tasks, re-routes only untouched ones, never deletes) -------------------------
create or replace function public.engine_refresh_journey_for(p_journey uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare j public.journeys; q public.questionnaire_responses; t public.roadmap_templates;
begin
  select * into j from public.journeys where id = p_journey;
  if not found then return; end if;
  select * into q from public.questionnaire_responses where user_id = j.user_id;
  if not found then return; end if;
  select * into t from public.roadmap_templates where active order by version desc limit 1;
  if not found then return; end if;

  update public.journeys set template_id = t.id where id = j.id and template_id <> t.id;

  insert into public.journey_tasks (journey_id, user_id, template_task_id, template_task_key, section, title, description,
      position, status, requires_evidence, external_verification, is_applicable, depends_on, completed_at, responsibility, action_href)
  select j.id, j.user_id, tt.id, tt.key, tt.section, tt.title, tt.description, tt.position,
      case when tt.auto_complete then 'completed' else 'not_started' end,
      tt.requires_evidence, tt.external_verification, public.engine_applies(tt.applies_when, q), tt.depends_on,
      case when tt.auto_complete then now() end, tt.responsibility, tt.action_href
  from public.roadmap_template_tasks tt where tt.template_id = t.id
  on conflict (journey_id, template_task_key) do nothing;

  -- link existing tasks to the newest template row and refresh display metadata only
  update public.journey_tasks jt set template_task_id = tt.id, responsibility = tt.responsibility, action_href = tt.action_href,
         position = tt.position, depends_on = tt.depends_on
    from public.roadmap_template_tasks tt
   where jt.journey_id = j.id and tt.template_id = t.id and tt.key = jt.template_task_key;

  -- re-route applicability ONLY for tasks the applicant has not touched
  update public.journey_tasks jt set is_applicable = public.engine_applies(tt.applies_when, q)
    from public.roadmap_template_tasks tt
   where jt.journey_id = j.id and tt.id = jt.template_task_id and jt.status = 'not_started'
     and jt.is_applicable is distinct from public.engine_applies(tt.applies_when, q);

  -- a host offer stated in onboarding counts only when evidence was given
  if q.host_state = 'offer' and btrim(q.host_evidence_note) <> '' then
    perform public.engine_set_task(j.id, 'host_offer_received', 'completed', q.host_evidence_note);
  end if;
  if q.sponsor_state = 'accepted' then
    perform public.engine_set_task(j.id, 'sponsor_accepts_application', 'in_progress');
  end if;
  perform public.engine_sync_employer(j.id);
  perform public.engine_sync_sponsors(j.id);
  insert into public.journey_state (journey_id, user_id) values (j.id, j.user_id) on conflict (journey_id) do nothing;
  if exists (select 1 from public.resumes where user_id = j.user_id) then
    perform public.engine_set_task(j.id, 'prepare_cv', 'completed', 'Resume saved in PathWise');
  end if;
end $$;
revoke all on function public.engine_refresh_journey_for(uuid) from public, anon, authenticated;

-- upsert_journey now delegates task creation to the engine (same signature, same grants)
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
  perform public.engine_refresh_journey_for(j.id);
  delete from public.onboarding_drafts where user_id = uid;
  insert into public.activity_events (user_id, journey_id, event_type) values (uid, j.id, 'journey_synced');
  return j.id;
end $$;
revoke all on function public.upsert_journey() from public, anon;
grant execute on function public.upsert_journey() to authenticated;

-- 12. Row Level Security -----------------------------------------------------------------------------------------------------------
alter table public.roadmap_stages enable row level security;
alter table public.opportunities enable row level security;
alter table public.employer_applications enable row level security;
alter table public.opportunity_dismissals enable row level security;
alter table public.resumes enable row level security;
alter table public.journey_state enable row level security;
alter table public.onboarding_drafts enable row level security;
alter table public.external_facts enable row level security;

create policy stages_read on public.roadmap_stages for select to authenticated using (true);
create policy opportunities_read on public.opportunities for select to authenticated using (true);
create policy apps_select on public.employer_applications for select to authenticated using (user_id = (select auth.uid()));
create policy apps_insert on public.employer_applications for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (select 1 from public.journeys j where j.id = journey_id and j.user_id = (select auth.uid())));
create policy apps_update on public.employer_applications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy apps_delete on public.employer_applications for delete to authenticated using (user_id = (select auth.uid()) and status = 'saved');
create policy dismiss_select on public.opportunity_dismissals for select to authenticated using (user_id = (select auth.uid()));
create policy dismiss_insert on public.opportunity_dismissals for insert to authenticated with check (user_id = (select auth.uid()));
create policy dismiss_delete on public.opportunity_dismissals for delete to authenticated using (user_id = (select auth.uid()));
create policy resumes_select on public.resumes for select to authenticated using (user_id = (select auth.uid()));
create policy resumes_insert on public.resumes for insert to authenticated with check (user_id = (select auth.uid()));
create policy resumes_update on public.resumes for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy state_select on public.journey_state for select to authenticated using (user_id = (select auth.uid()));
create policy state_insert on public.journey_state for insert to authenticated with check (user_id = (select auth.uid())
  and exists (select 1 from public.journeys j where j.id = journey_id and j.user_id = (select auth.uid())));
create policy state_update on public.journey_state for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy drafts_select on public.onboarding_drafts for select to authenticated using (user_id = (select auth.uid()));
create policy drafts_insert on public.onboarding_drafts for insert to authenticated with check (user_id = (select auth.uid()));
create policy drafts_update on public.onboarding_drafts for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy facts_select on public.external_facts for select to authenticated using (user_id = (select auth.uid()));
create policy facts_insert on public.external_facts for insert to authenticated with check (
  user_id = (select auth.uid()) and status = 'claimed' and exists (select 1 from public.journeys j where j.id = journey_id and j.user_id = (select auth.uid())));

-- Table privileges (least privilege). Applicants can never UPDATE external_facts, so they cannot confirm anything.
revoke all on public.roadmap_stages, public.opportunities, public.employer_applications, public.opportunity_dismissals,
  public.resumes, public.journey_state, public.onboarding_drafts, public.external_facts from anon, authenticated;
grant select on public.roadmap_stages, public.opportunities, public.employer_applications, public.opportunity_dismissals,
  public.resumes, public.journey_state, public.onboarding_drafts, public.external_facts to authenticated;
grant insert (journey_id, user_id, opportunity_id, status, notes, evidence_note) on public.employer_applications to authenticated;
grant update (status, notes, evidence_note) on public.employer_applications to authenticated;
grant delete on public.employer_applications to authenticated;
grant insert, delete on public.opportunity_dismissals to authenticated;
grant insert (user_id, kind, file_path, file_name, built_data) on public.resumes to authenticated;
grant update (kind, file_path, file_name, built_data) on public.resumes to authenticated;
grant insert (journey_id, user_id, resume_choice) on public.journey_state to authenticated;
grant update (resume_choice) on public.journey_state to authenticated;
grant insert (user_id, answers, step_key) on public.onboarding_drafts to authenticated;
-- user_id is included because an upsert also sets it; RLS (with check) still stops anyone writing another user's row
grant update (user_id, answers, step_key) on public.onboarding_drafts to authenticated;
grant insert (user_id, journey_id, fact_type, evidence_note) on public.external_facts to authenticated;

-- 13. Private resume storage (5 MB, PDF/DOCX, one folder per user) ----------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 5242880,
  array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;
create policy resumes_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy resumes_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy resumes_obj_update on storage.objects for update to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy resumes_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);
