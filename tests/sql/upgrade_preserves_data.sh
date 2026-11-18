#!/usr/bin/env bash
# Simulates an existing Milestone 1/2 user with saved progress, then applies 0005, 0006 and the backfill, and asserts nothing was lost.
# Usage: PGURL=postgres://user@host:port bash tests/sql/upgrade_preserves_data.sh   (THROWAWAY Postgres only)
set -e
cd "$(dirname "$0")/../.."
psql "$PGURL/postgres" -q -c "drop database if exists pw_upgrade" -c "create database pw_upgrade"
P="psql $PGURL/pw_upgrade -v ON_ERROR_STOP=1 -q -t -A"
$P -f tests/sql/supabase_stub.sql 2>/dev/null
for f in supabase/migrations/000{1,2,3,4}*.sql; do $P -f "$f"; done
$P <<'EOF'
insert into auth.users (id,email) values ('11111111-1111-1111-1111-111111111111','a@x.test');
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set role authenticated;
insert into public.questionnaire_responses (user_id,country_of_residence,citizenship,education_status,experience_level,career_field,program_category,destination_city,duration_months,budget_range,has_host,has_agency_quote)
 values ('11111111-1111-1111-1111-111111111111','Brazil','Brazil','recent_graduate','none','marketing','intern','Miami',6,'8000_to_12000',true,false);
select public.upsert_journey();
update public.journey_tasks set status='in_progress', notes='my note' where template_task_key='define_target_roles';
update public.journey_tasks set status='in_progress', evidence_note='mail' where template_task_key='record_host_details';
EOF
$P -f supabase/migrations/0005_journey_engine.sql -f supabase/migrations/0006_roadmap_template_v2.sql -f supabase/seeds/engine_backfill_existing_journeys.sql >/dev/null
$P <<'EOF'
do $$ begin
  assert (select count(*) from public.journey_tasks) = 33, 'expected 26 old + 7 new tasks';
  assert (select notes from public.journey_tasks where template_task_key='define_target_roles') = 'my note', 'note lost';
  assert (select status from public.journey_tasks where template_task_key='record_host_details') = 'in_progress', 'status lost';
  assert (select evidence_note from public.journey_tasks where template_task_key='record_host_details') = 'mail', 'evidence lost';
  assert (select host_state from public.questionnaire_responses) = 'interested', 'old has_host answer should become interested, never offer';
  assert (select count(*) from public.questionnaire_responses) = 1 and (select count(*) from public.journeys) = 1, 'rows changed';
  assert not (select is_applicable from public.journey_tasks where template_task_key='contact_employers'), 'retired task should be inapplicable';
  assert (select count(*) from public.activity_events where event_type='journey_synced') >= 1, 'history lost';
  raise notice 'UPGRADE OK: progress, notes, evidence, answers and history preserved';
end $$;
EOF
