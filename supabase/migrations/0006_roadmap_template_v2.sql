-- PathWise Milestone 2.5: roadmap template v2 (copies v1, then adds/re-routes). Run AFTER 0005. Safe to run once.
-- Existing journeys are untouched until the backfill (supabase/seeds/engine_backfill_existing_journeys.sql) runs.
do $$
declare v1 uuid; v2 uuid;
begin
  if exists (select 1 from public.roadmap_templates where key = 'j1_self_placement' and version = 2) then
    raise exception 'Template v2 is already installed.';
  end if;
  select id into v1 from public.roadmap_templates where key = 'j1_self_placement' and version = 1;
  if v1 is null then raise exception 'Template v1 not found. Run 0002 first.'; end if;

  insert into public.roadmap_templates (key, version, title, active) values ('j1_self_placement', 2, 'J-1 self-placement roadmap (v2)', true) returning id into v2;

  insert into public.roadmap_template_tasks (template_id, key, section, title, description, position, requires_evidence, external_verification, auto_complete, applies_when, depends_on)
  select v2, key, section, title, description, position * 10, requires_evidence, external_verification, auto_complete, applies_when, depends_on
    from public.roadmap_template_tasks where template_id = v1;

  -- retired by the discovery workflow (kept so earlier progress is preserved; never shown to new applicants)
  update public.roadmap_template_tasks set applies_when = '{"retired": true}'
   where template_id = v2 and key in ('shortlist_employers','contact_employers','host_written_interest');

  update public.roadmap_template_tasks set applies_when = '{"host_state":["interested","offer"]}', depends_on = '{}', action_href = '/journey/employer'
   where template_id = v2 and key = 'record_host_details';
  update public.roadmap_template_tasks set action_href = '/journey/employer' where template_id = v2 and key in ('define_target_roles','prepare_cv');

  -- sponsor search steps are not needed once a sponsor has already accepted you
  update public.roadmap_template_tasks set applies_when = '{"sponsor_state":["none","applied"]}', action_href = '/sponsors'
   where template_id = v2 and key in ('select_sponsor');
  update public.roadmap_template_tasks set applies_when = '{"sponsor_state":["none"]}', action_href = '/sponsors'
   where template_id = v2 and key in ('research_sponsors','check_self_placement_policy','compare_total_costs');

  update public.roadmap_template_tasks set responsibility = 'sponsor'
   where template_id = v2 and key in ('confirm_category_with_sponsor','sponsor_accepts_application','sponsor_issues_documents');
  update public.roadmap_template_tasks set responsibility = 'government' where template_id = v2 and key = 'visa_decision';

  insert into public.roadmap_template_tasks (template_id, key, section, title, description, position, requires_evidence, external_verification, auto_complete, applies_when, depends_on, responsibility, action_href) values
  (v2,'save_first_opportunity','employer_journey','Save your first opportunity','Browse listings and save one. Saving is research only; it does not mean an employer will host you.',45,false,false,false,'{"host_state":["none","interested"]}','{define_target_roles}','applicant','/journey/employer'),
  (v2,'submit_first_application','employer_journey','Send your first application and record the proof','Apply through the employer''s own channel, then save a link or note showing you sent it. PathWise does not send anything for you.',55,true,false,false,'{"host_state":["none","interested"]}','{save_first_opportunity}','applicant','/journey/employer'),
  (v2,'employer_replied','employer_journey','Record an employer reply','A reply starts a conversation. It does not mean you have a host.',58,false,false,false,'{"host_state":["none","interested"]}','{submit_first_application}','applicant','/journey/employer'),
  (v2,'host_offer_received','employer_journey','Record a written offer or host confirmation','Save the evidence. This identifies a host, subject to sponsor verification. It is not sponsor approval.',85,true,false,false,'{}','{}','applicant','/journey/employer'),
  (v2,'shortlist_sponsors','sponsor_journey','Shortlist sponsors','Save the designated sponsors you want to compare.',95,false,false,false,'{"sponsor_state":["none"]}','{}','applicant','/sponsors'),
  (v2,'choose_preferred_sponsor','sponsor_journey','Choose your preferred sponsor','This records your choice only. The sponsor still has to accept your application.',105,false,false,false,'{"sponsor_state":["none"]}','{shortlist_sponsors}','applicant','/sponsors'),
  (v2,'sponsor_reviews_host','sponsor_journey','Sponsor reviews your host and training plan','Only your sponsor can confirm this.',135,false,true,false,'{}','{host_offer_received,select_sponsor}','sponsor','/journey/sponsor');

  update public.roadmap_template_tasks set action_href = '/journey/sponsor'
   where template_id = v2 and key in ('sponsor_accepts_application','confirm_category_with_sponsor','sponsor_issues_documents');
end $$;
