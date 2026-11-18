# Installing Milestone 2.5 on PathWise-dev

1. **Back up first.** Supabase dashboard → Database → Backups (or export your tables). Note row counts: profiles, questionnaire_responses, journeys, journey_tasks.
2. Copy this folder's files over your project (same paths). Do not touch `.env.local`.
3. In Supabase → SQL Editor, run these **once, in order**, one file per run:
   1. `supabase/migrations/0005_journey_engine.sql`
   2. `supabase/migrations/0006_roadmap_template_v2.sql`
   3. `supabase/seeds/engine_backfill_existing_journeys.sql`
   4. `supabase/seeds/sample_opportunities.sql` (fictional samples; delete before launch)
4. Check counts again: your accounts, answers and started tasks must be unchanged; journeys gain 7 tasks.
5. `npm install`, `npm run typecheck`, `npm test`, then `npm run dev`.
6. Try it: log in → **My journey** map. New account → answer the questions one at a time (refresh midway to see resume) → "Building your PathWise journey…" → map → Employer Discovery → résumé modal → Save a sample → it appears in your workspace and the map moves.

## Confirming an official milestone (administrator only)
An applicant can only *claim* a sponsor/visa step. After you verify it with the source, in the SQL Editor:

    update public.external_facts set status = 'confirmed', confirmed_by = 'your name'
    where id = '<fact id>';   -- or status = 'rejected' to reopen the step

## Tests
* `npm test` unit tests. `npm run test:rls` (needs `.env.test`, PathWise-dev only).
* `npm run test:sql` runs migrations and scenarios on a **throwaway local Postgres** (`PGURL=postgres://postgres@localhost:5432`). Never your real project.

## Rollback
Everything is additive. To undo: `drop` the new tables and columns listed in `0005`, delete the v2 template (`delete from roadmap_templates where version = 2`), and restore `journey_tasks_rules`/`upsert_journey` from `0001`. Restoring the backup is the safest path.

## Honest limits of what was verified
Verified: all six migrations, upgrade-preservation, 60+ database checks, 75 unit checks on a real Postgres 16 / Node. **Not** verified here: `next build`, React type-checking, vitest itself, a real Supabase project (auth, Storage upload, RLS over PostgREST), or the screens in a browser. Run steps 5–6 and tell me what breaks.
