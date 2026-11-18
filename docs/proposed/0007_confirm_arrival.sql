-- PROPOSED, NOT APPLIED. Review before moving to supabase/migrations/ and running.
-- Adds the applicant-confirmed "I have arrived in the U.S." task that drives the map's finish celebration.
-- Follows the 0006 pattern: a new template version copied from the current one, plus one task. Existing journeys are untouched
-- until a backfill is run (not included here; mirror supabase/seeds/engine_backfill_existing_journeys.sql if you want it).
-- The task is NOT external_verification: the applicant is the only one who can say they physically arrived, and the map says so.
do $$
declare cur uuid; nxt uuid; nv int;
begin
  select id, version into cur, nv from public.roadmap_templates where key = 'j1_self_placement' and active order by version desc limit 1;
  if cur is null then raise exception 'No active template found.'; end if;
  if exists (select 1 from public.roadmap_template_tasks where template_id = cur and key = 'confirm_arrival') then
    raise exception 'confirm_arrival already exists in the active template.';
  end if;
  update public.roadmap_templates set active = false where id = cur;
  insert into public.roadmap_templates (key, version, title, active)
    values ('j1_self_placement', nv + 1, 'J-1 self-placement roadmap (v' || (nv + 1) || ')', true) returning id into nxt;
  -- copy every column the current template task rows have, then add the new task (copy list matches 0006; extend if later migrations add columns)
  insert into public.roadmap_template_tasks (template_id, key, section, title, description, position, requires_evidence, external_verification, auto_complete, applies_when, depends_on, action_href, responsibility)
  select nxt, key, section, title, description, position, requires_evidence, external_verification, auto_complete, applies_when, depends_on, action_href, responsibility
    from public.roadmap_template_tasks where template_id = cur;
  insert into public.roadmap_template_tasks (template_id, key, section, title, description, position, requires_evidence, external_verification, auto_complete, applies_when, depends_on)
    values (nxt, 'confirm_arrival', 'arrival_relocation', 'Confirm you have arrived in the U.S.', 'Only you can confirm this. It is not verified by PathWise or the government.', 100000, false, false, false, '{}', '{visa_decision}');
end $$;
