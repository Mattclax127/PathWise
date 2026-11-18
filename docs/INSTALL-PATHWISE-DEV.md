# Installing Milestone 2 into your PathWise-dev Supabase project

Everything here is additive. Nothing drops, renames, or rewrites a Milestone 1 table. Do not re-run 0001 or 0002.
No secret keys are needed for installation. Do this on PathWise-dev only, never on production.

## 0. Back up and take a snapshot (5 minutes)
1. In Git: `git checkout -b milestone-2-install` and commit your current state.
2. Supabase dashboard > Database > Backups: make sure a recent backup exists (or download one).
3. SQL Editor, run this and **write down the numbers**:
```sql
select
  (select count(*) from auth.users)                  as users,
  (select count(*) from public.profiles)             as profiles,
  (select count(*) from public.questionnaire_responses) as answers,
  (select count(*) from public.journeys)             as journeys,
  (select count(*) from public.journey_tasks)        as tasks,
  (select count(*) from public.journey_tasks where status = 'completed') as completed_tasks,
  (select count(*) from public.activity_events)      as events;
```
4. Check whether Milestone 2 was already partly applied:
```sql
select table_name from information_schema.tables where table_schema = 'public' and table_name like 'sponsor%' or table_name in ('government_fees','journey_sponsor_options');
```
   - Empty result: fresh install, do steps 1 to 3 below.
   - Rows returned: 0003 was already applied. **Skip step 1**, do steps 2 and 3. If it was applied only partly (some tables but not all), stop and send me the list.

## 1. Run `supabase/migrations/0003_sponsors.sql` (creates new tables only)
Paste the whole file into the SQL Editor and run it. It should finish with no errors. If you see "relation already exists", 0003 was already applied: do not run it again.

## 2. Run `supabase/migrations/0004_sponsor_refinements.sql`
Adds three columns to the new sponsor tables. Safe to run more than once.

## 3. Load the sponsor data: `supabase/seeds/sponsors.generated.sql`
Paste and run. It is wrapped in a transaction and safe to re-run. It only touches sponsor tables and `government_fees`.

## 4. Check that nothing in Milestone 1 changed
Re-run the snapshot query from step 0.3. Every number must be identical. Then:
```sql
-- What the public can see (should be 5 sponsors; CIEE stays hidden)
select name from public.sponsors where is_published and record_status = 'verified' order by name;
-- Counts of new data
select (select count(*) from public.sponsor_fee_schedules where status='verified') as verified_schedules,
       (select count(*) from public.government_fees where review_status='verified') as gov_fees;
```
Expected: American Immigration Council, CETUSA, Cultural Vistas, InterExchange, Spirit Cultural Exchange.

## 5. Run the app and the tests
```
git pull / copy the new files (see CHANGES-M2.md)
npm install
npm run typecheck
npm test
npm run test:rls      # needs .env.test; uses throwaway users; PathWise-dev only
npm run dev
```
Then by hand: log in with an existing Milestone 1 account, confirm the dashboard and your tasks look the same, open /questionnaire (answers still there), open /sponsors, pick Intern, 6 months, and test the calculator.

## Rollback (only if something is wrong)
Milestone 2 added only new objects, so rollback never touches your accounts or progress. In the SQL Editor:
```sql
drop table if exists public.journey_sponsor_options, public.sponsor_fee_inclusions, public.sponsor_fee_components,
  public.sponsor_fee_schedules, public.sponsor_requirements, public.sponsor_policies, public.sponsor_programs,
  public.sponsor_sources, public.government_fees, public.sponsors cascade;
drop function if exists public.set_preferred_sponsor(uuid);
drop function if exists public.on_preferred_sponsor();
```
Re-run the step 0.3 snapshot to confirm Milestone 1 data is unchanged. In Git, `git checkout main` restores the code.
