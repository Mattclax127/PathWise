-- Roadmap template v1. Generic, process-level steps only. Official requirements come from the
-- sponsor and government sources; this template never states eligibility rules.
do $$
declare tid uuid;
begin
  insert into public.roadmap_templates (key, version, title, active)
  values ('j1_self_placement', 1, 'J-1 self-placement roadmap', true) returning id into tid;

  insert into public.roadmap_template_tasks
    (template_id, key, section, title, description, position, requires_evidence, external_verification, auto_complete, applies_when, depends_on) values
  (tid,'complete_questionnaire','profile_eligibility','Complete your PathWise questionnaire','Your answers personalize this roadmap. You can update them any time.',1,false,false,true,'{}','{}'),
  (tid,'review_profile_details','profile_eligibility','Review your education and work history details','Gather dates, degrees, and roles you will need when talking to sponsors and hosts.',2,false,false,false,'{}','{complete_questionnaire}'),
  (tid,'confirm_category_with_sponsor','profile_eligibility','Ask a designated sponsor to confirm your program category and eligibility','Only a designated sponsor can confirm this. Mark the step as awaiting confirmation once you have asked.',3,false,true,false,'{}','{review_profile_details}'),

  (tid,'define_target_roles','employer_journey','Define your target roles, industries, and city','Write down the roles and sectors you want in your destination city.',4,false,false,false,'{}','{complete_questionnaire}'),
  (tid,'shortlist_employers','employer_journey','Shortlist employers that may host J-1 participants','Collect organizations to approach. A shortlist is not proof an employer hosts J-1 participants.',5,false,false,false,'{"has_host": false}','{define_target_roles}'),
  (tid,'contact_employers','employer_journey','Contact employers and track replies','Send your own messages and note each reply.',6,false,false,false,'{"has_host": false}','{shortlist_employers}'),
  (tid,'record_host_details','employer_journey','Record your host organization''s contact details','Save the organization name, contact person, and role.',7,false,false,false,'{"has_host": true}','{}'),
  (tid,'host_written_interest','employer_journey','Get your host''s willingness to participate in writing','Save an email or link as evidence.',8,true,false,false,'{"has_host": true}','{record_host_details}'),

  (tid,'research_sponsors','sponsor_journey','Research designated sponsors for your category','You can do this at the same time as your employer search.',9,false,false,false,'{}','{complete_questionnaire}'),
  (tid,'check_self_placement_policy','sponsor_journey','Check each sponsor''s policy on self-arranged placements','Save a source link as evidence.',10,true,false,false,'{}','{research_sponsors}'),
  (tid,'compare_total_costs','sponsor_journey','Compare sponsor fees and total costs','Compare required sponsor and visa costs separately from optional agency fees.',11,false,false,false,'{}','{research_sponsors}'),
  (tid,'select_sponsor','sponsor_journey','Choose a sponsor and submit their application','Add a reference or confirmation note as evidence.',12,true,false,false,'{}','{check_self_placement_policy,compare_total_costs}'),
  (tid,'sponsor_accepts_application','sponsor_journey','Sponsor confirms your application is accepted','Only the sponsor can confirm this.',13,false,true,false,'{}','{select_sponsor}'),

  (tid,'prepare_cv','document_preparation','Prepare your CV and supporting profile information','Draft a CV that uses only facts about your real experience.',14,false,false,false,'{}','{complete_questionnaire}'),
  (tid,'collect_sponsor_requirements','document_preparation','Collect your sponsor''s document requirements','Requirements vary by sponsor. Use your sponsor''s own checklist.',15,false,false,false,'{}','{select_sponsor}'),
  (tid,'draft_training_plan','document_preparation','Prepare the training or internship plan with your host','Sponsor forms and processes vary. Follow your sponsor''s instructions.',16,false,false,false,'{}','{collect_sponsor_requirements}'),
  (tid,'sponsor_issues_documents','document_preparation','Sponsor issues your program documents','Only your designated sponsor can issue these.',17,false,true,false,'{}','{draft_training_plan,sponsor_accepts_application}'),

  (tid,'receive_program_documents','visa_application','Receive and review your program documents','Check that your details are correct and tell your sponsor about any error.',18,false,false,false,'{}','{sponsor_issues_documents}'),
  (tid,'pay_sevis_fee','visa_application','Pay the SEVIS fee on the official site','Save your payment confirmation as evidence.',19,true,false,false,'{}','{receive_program_documents}'),
  (tid,'complete_ds160','visa_application','Complete the DS-160 on the official government site','Save your confirmation as evidence.',20,true,false,false,'{}','{receive_program_documents}'),
  (tid,'book_embassy_appointment','visa_application','Book your embassy or consulate appointment','Save the appointment details as evidence.',21,true,false,false,'{}','{pay_sevis_fee,complete_ds160}'),
  (tid,'visa_decision','visa_application','Record the visa decision','The decision is made by the government. Mark awaiting confirmation until you have it.',22,false,true,false,'{}','{book_embassy_appointment}'),

  (tid,'plan_budget','arrival_relocation','Plan your relocation and living budget','Estimate costs for your destination city.',23,false,false,false,'{}','{complete_questionnaire}'),
  (tid,'arrange_insurance','arrival_relocation','Arrange insurance that meets your sponsor''s requirements','Use your sponsor''s stated requirements.',24,false,false,false,'{}','{select_sponsor}'),
  (tid,'plan_housing','arrival_relocation','Plan housing in your destination city','Compare options and note deposits and dates.',25,false,false,false,'{}','{plan_budget}'),
  (tid,'plan_travel','arrival_relocation','Plan travel and arrival','Book travel after your visa decision.',26,false,false,false,'{}','{visa_decision}');
end $$;
