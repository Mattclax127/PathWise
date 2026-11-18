-- PathWise 2.5 engine scenarios. Run on a THROWAWAY database after migrations 0001-0006 (see tests/sql/README.md).
-- Prints "ok - ..." per check and aborts on the first failure. Never run against your real project.
create schema if not exists t;
grant usage on schema t to authenticated;
create or replace function t.eq(label text, actual anyelement, expected anyelement) returns void language plpgsql as $$
begin if actual is distinct from expected then raise exception 'FAIL % : expected %, got %', label, expected, actual; end if; raise notice 'ok - %', label; end $$;
create or replace function t.fails(label text, stmt text, pattern text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then
    if sqlerrm ilike '%' || pattern || '%' then raise notice 'ok - % (blocked: %)', label, left(sqlerrm, 70); return; end if;
    raise exception 'FAIL % : wrong error: %', label, sqlerrm;
  end;
  raise exception 'FAIL % : statement was allowed', label;
end $$;
grant execute on all functions in schema t to authenticated;
create or replace function t.st(jid uuid, k text) returns text language sql as $$ select status from public.journey_tasks where journey_id = jid and template_task_key = k $$;
create or replace function t.app(jid uuid, k text) returns boolean language sql as $$ select is_applicable from public.journey_tasks where journey_id = jid and template_task_key = k $$;
grant execute on function t.st(uuid,text), t.app(uuid,text) to authenticated;

insert into auth.users (id, email) values
 ('aaaaaaaa-0000-0000-0000-00000000000a','a@t.test'),('bbbbbbbb-0000-0000-0000-00000000000b','b@t.test'),
 ('cccccccc-0000-0000-0000-00000000000c','c@t.test'),('dddddddd-0000-0000-0000-00000000000d','d@t.test');
insert into public.sponsors (slug, name, record_status, is_published, is_sample) values ('test-sponsor-1','Test Sponsor 1','verified',true,true),('test-sponsor-2','Test Sponsor 2','verified',true,true);
\i supabase/seeds/sample_opportunities.sql

-- helper to create a user's questionnaire + journey as that user
create or replace function t.onboard(uid uuid, host text, sponsor text, evidence text) returns uuid language plpgsql as $$
declare j uuid;
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
  execute 'set role authenticated';
  insert into public.questionnaire_responses (user_id,country_of_residence,citizenship,education_status,experience_level,career_field,program_category,destination_city,duration_months,budget_range,has_host,has_agency_quote,host_state,sponsor_state,host_evidence_note)
   values (uid,'Brazil','Brazil','recent_graduate','none','marketing','intern','Miami',6,'8000_to_12000',host<>'none',false,host,sponsor,coalesce(evidence,''));
  j := public.upsert_journey();
  return j;
end $$;
grant execute on function t.onboard(uuid,text,text,text) to authenticated;
create or replace function t.as_admin() returns void language plpgsql as $$ begin execute 'reset role'; end $$;

-- ===== Applicant A: no host, no sponsor =====
select t.onboard('aaaaaaaa-0000-0000-0000-00000000000a','none','none',null) as ja \gset
select t.eq('A: search and sponsor-research tasks apply', t.app(:'ja','save_first_opportunity') and t.app(:'ja','research_sponsors') and t.app(:'ja','shortlist_sponsors'), true);
select t.eq('A: tasks for an existing host do not apply', t.app(:'ja','record_host_details'), false);
select t.eq('A: questionnaire completes first task', t.st(:'ja','complete_questionnaire'), 'completed');
select o.id as opp from public.opportunities o where city='Miami' and career_field='marketing' limit 1 \gset
insert into public.employer_applications (user_id, journey_id, opportunity_id) values ('aaaaaaaa-0000-0000-0000-00000000000a', :'ja', :'opp');
select t.eq('A: saving a listing completes save_first_opportunity', t.st(:'ja','save_first_opportunity'), 'completed');
select t.eq('A: saving does NOT start applications', t.st(:'ja','submit_first_application'), 'not_started');
select t.eq('A: saving does NOT secure a host', t.st(:'ja','host_offer_received'), 'not_started');
select t.fails('A: cannot mark submitted without evidence', $$update public.employer_applications set status='submitted'$$, 'check');
update public.employer_applications set status='submitted', evidence_note='sent email 2026-11-01';
select t.eq('A: submitted + evidence completes submit_first_application', t.st(:'ja','submit_first_application'), 'completed');
select t.eq('A: submitted does NOT mark a reply', t.st(:'ja','employer_replied'), 'not_started');
update public.employer_applications set status='responded';
select t.eq('A: reply completes employer_replied', t.st(:'ja','employer_replied'), 'completed');
select t.eq('A: reply does NOT secure a host', t.st(:'ja','host_offer_received'), 'not_started');
update public.employer_applications set status='offer_received', evidence_note='offer letter ref 123';
select t.eq('A: written offer + evidence records host_offer_received', t.st(:'ja','host_offer_received'), 'completed');
select t.eq('A: offer is NOT sponsor acceptance', t.st(:'ja','sponsor_accepts_application'), 'not_started');
select t.eq('A: offer is NOT sponsor review of host', t.st(:'ja','sponsor_reviews_host'), 'not_started');
update public.employer_applications set status='saved';
select t.eq('A: moving an application backwards never regresses the roadmap', t.st(:'ja','host_offer_received'), 'completed');
select t.fails('A: cannot complete sponsor-owned task', $$update public.journey_tasks set status='completed' where template_task_key='sponsor_reviews_host'$$, 'third party');
select t.fails('A: cannot flip applicability from the browser', $$update public.journey_tasks set is_applicable=false$$, 'permission denied');
-- sponsor branch runs in parallel
select id as sp from public.sponsors where slug='test-sponsor-1' \gset
select public.set_preferred_sponsor(:'sp');
select t.eq('A: saving sponsor starts research', t.st(:'ja','research_sponsors'), 'in_progress');
select t.eq('A: shortlist recorded', t.st(:'ja','shortlist_sponsors'), 'completed');
select t.eq('A: preferred sponsor recorded as selection only', t.st(:'ja','choose_preferred_sponsor'), 'completed');
select t.eq('A: choosing a sponsor is NOT sponsor acceptance', t.st(:'ja','sponsor_accepts_application'), 'not_started');

-- external fact: claim, cannot self-confirm, admin confirms
insert into public.external_facts (user_id, journey_id, fact_type, evidence_note) values ('aaaaaaaa-0000-0000-0000-00000000000a', :'ja', 'sponsor_accepts_application', 'acceptance email ref 9');
select t.eq('A: claim moves task to awaiting, never completed', t.st(:'ja','sponsor_accepts_application'), 'awaiting_external_confirmation');
select t.fails('A: cannot confirm own fact', $$update public.external_facts set status='confirmed'$$, 'permission denied');
select t.fails('A: cannot insert a pre-confirmed fact', $$insert into public.external_facts (user_id, journey_id, fact_type, evidence_note, status) select user_id, journey_id, 'visa_decision', 'x yz', 'confirmed' from public.external_facts$$, 'permission denied');
select t.fails('A: cannot claim twice', $$insert into public.external_facts (user_id, journey_id, fact_type, evidence_note) select user_id, journey_id, fact_type, 'again 123' from public.external_facts$$, 'duplicate');
select t.as_admin();
update public.external_facts set status='confirmed', confirmed_by='admin test' where fact_type='sponsor_accepts_application';
select t.eq('A: admin confirmation completes the official milestone', t.st(:'ja','sponsor_accepts_application'), 'completed');
select t.eq('A: audit trail records system actor', (select payload->>'actor' from public.activity_events where journey_id=:'ja' and event_type='task_status_changed' and payload->>'task_key'='sponsor_accepts_application' and payload->>'to'='completed'), 'system');

-- ===== Applicant B: has a written offer =====
select t.onboard('bbbbbbbb-0000-0000-0000-00000000000b','offer','none','offer letter from Sample Co, ref 77') as jb \gset
select t.eq('B: host offer recorded with evidence', t.st(:'jb','host_offer_received'), 'completed');
select t.eq('B: host evidence stored on the task', (select evidence_note from public.journey_tasks where journey_id=:'jb' and template_task_key='host_offer_received'), 'offer letter from Sample Co, ref 77');
select t.eq('B: host is NOT sponsor-approved', t.st(:'jb','sponsor_reviews_host'), 'not_started');
select t.eq('B: sponsor acceptance still open', t.st(:'jb','sponsor_accepts_application'), 'not_started');
select t.eq('B: employer search steps do not apply', t.app(:'jb','save_first_opportunity'), false);
select t.eq('B: sponsor research still applies', t.app(:'jb','research_sponsors'), true);
select t.eq('B: host details task applies', t.app(:'jb','record_host_details'), true);

-- ===== Applicant C: says a sponsor already accepted them =====
select t.onboard('cccccccc-0000-0000-0000-00000000000c','none','accepted',null) as jc \gset
select t.eq('C: sponsor search steps skipped', t.app(:'jc','research_sponsors') or t.app(:'jc','shortlist_sponsors') or t.app(:'jc','compare_total_costs'), false);
select t.eq('C: acceptance is NOT completed by self-report', t.st(:'jc','sponsor_accepts_application'), 'in_progress');
select t.fails('C: cannot self-complete sponsor acceptance', $$update public.journey_tasks set status='completed' where template_task_key='sponsor_accepts_application'$$, 'third party');
select t.fails('C: cannot self-complete DS-2019 step', $$update public.journey_tasks set status='completed' where template_task_key='sponsor_issues_documents'$$, 'third party');
select t.fails('C: cannot self-complete visa decision', $$update public.journey_tasks set status='completed' where template_task_key='visa_decision'$$, 'third party');
select t.eq('C: official milestones are marked for the UI', (select count(*) from public.journey_tasks where journey_id=:'jc' and external_verification)::int, 5);

-- ===== Applicant D + cross-account isolation =====
select t.onboard('dddddddd-0000-0000-0000-00000000000d','none','none',null) as jd \gset
select t.eq('D: sees only own journey', (select count(*) from public.journeys)::int, 1);
select t.eq('D: sees none of A''s applications', (select count(*) from public.employer_applications)::int, 0);
select t.eq('D: sees none of A''s facts', (select count(*) from public.external_facts)::int, 0);
select t.fails('D: cannot save an application into A''s journey', format($$insert into public.employer_applications (user_id, journey_id, opportunity_id) values ('dddddddd-0000-0000-0000-00000000000d', %L, %L)$$, :'ja', :'opp'), 'row-level security');
select t.fails('D: cannot claim a fact for A''s journey', format($$insert into public.external_facts (user_id, journey_id, fact_type, evidence_note) values ('dddddddd-0000-0000-0000-00000000000d', %L, 'visa_decision', 'abc def')$$, :'ja'), 'row-level security');
select t.fails('D: cannot create a record as someone else', $$insert into public.opportunity_dismissals (user_id, opportunity_id) select 'aaaaaaaa-0000-0000-0000-00000000000a', id from public.opportunities limit 1$$, 'row-level security');
select t.fails('D: cannot read A''s resume folder', $$insert into storage.objects (bucket_id, name) values ('resumes','aaaaaaaa-0000-0000-0000-00000000000a/x.pdf')$$, 'row-level security');
insert into storage.objects (bucket_id, name) values ('resumes','dddddddd-0000-0000-0000-00000000000d/cv.pdf');
select t.eq('D: may write own resume folder', (select count(*) from storage.objects)::int, 1);

-- dismissals with undo
insert into public.opportunity_dismissals (user_id, opportunity_id) values ('dddddddd-0000-0000-0000-00000000000d', :'opp');
select t.eq('D: dismissal saved', (select count(*) from public.opportunity_dismissals)::int, 1);
delete from public.opportunity_dismissals where opportunity_id = :'opp';
select t.eq('D: undo removes the dismissal', (select count(*) from public.opportunity_dismissals)::int, 0);

-- resume completes prepare_cv; skip persists
insert into public.resumes (user_id, kind, built_data) values ('dddddddd-0000-0000-0000-00000000000d','built','{"summary":"x"}');
select t.eq('D: building a resume completes prepare_cv', t.st(:'jd','prepare_cv'), 'completed');
select t.eq('D: resume choice persisted', (select resume_choice from public.journey_state where journey_id=:'jd'), 'built');

-- onboarding autosave uses an upsert, exactly as PostgREST issues it
insert into public.onboarding_drafts (user_id, answers, step_key) values ('dddddddd-0000-0000-0000-00000000000d','{"citizenship":"Brazil"}','citizenship')
  on conflict (user_id) do update set user_id = excluded.user_id, answers = excluded.answers, step_key = excluded.step_key;
insert into public.onboarding_drafts (user_id, answers, step_key) values ('dddddddd-0000-0000-0000-00000000000d','{"citizenship":"Peru"}','education_status')
  on conflict (user_id) do update set user_id = excluded.user_id, answers = excluded.answers, step_key = excluded.step_key;
select t.eq('D: draft autosave upsert works and overwrites', (select answers->>'citizenship' from public.onboarding_drafts), 'Peru');
select t.fails('D: cannot write a draft for someone else', $$insert into public.onboarding_drafts (user_id, answers) values ('aaaaaaaa-0000-0000-0000-00000000000a','{}')$$, 'row-level security');
select t.fails('D: cannot reassign a draft to someone else', $$update public.onboarding_drafts set user_id='aaaaaaaa-0000-0000-0000-00000000000a'$$, 'row-level security');

-- re-running the journey sync keeps all progress
select t.as_admin();
select public.engine_refresh_journey_for(:'ja');
select t.eq('refresh keeps confirmed official milestone', t.st(:'ja','sponsor_accepts_application'), 'completed');
select t.eq('refresh keeps recorded host offer', t.st(:'ja','host_offer_received'), 'completed');
select t.eq('unknown rule keys fail closed', public.engine_applies('{"made_up":1}'::jsonb, (select q from public.questionnaire_responses q limit 1)), false);
\echo ALL SCENARIOS PASSED
