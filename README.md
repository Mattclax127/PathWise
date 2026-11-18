# PathWise (Milestone 1)

Accounts, a saved questionnaire, a personalized roadmap ("My J-1 Journey"), and a dashboard whose progress is calculated from saved task states.

Stack: Next.js 16 (App Router, TypeScript), Supabase (Postgres, Auth), `@supabase/ssr`, Zod, Vitest.
PathWise is not a sponsor or law firm. The roadmap never states eligibility rules; sponsors and government sources decide.

## What you must set up in Supabase
1. Create a project (use a separate project, or the Supabase CLI `supabase start`, for tests).
2. Authentication > Providers: keep Email enabled. Keep "Confirm email" ON for production (OFF is fine for local testing).
3. Authentication > URL Configuration: Site URL `http://localhost:3000`; add Redirect URL `http://localhost:3000/**` (and your deployed URL later).
4. Authentication > Email Templates: set the links so they go through the app.
   - Confirm signup: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/questionnaire`
   - Reset password: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/update-password`
5. Run the migrations in order: `supabase/migrations/0001_core.sql`, then `0002_seed_roadmap_template.sql` (SQL Editor, or `supabase link` + `supabase db push`).
6. Project Settings > API Keys: copy the Project URL and the **publishable** key.

## Run it
```
npm install
cp .env.example .env.local   # fill in URL and publishable key
npm run dev
```
Commit `package-lock.json`. Never commit `.env*` files (already in `.gitignore`).

## Tests
```
npm test            # unit tests: progress, next action, task rules (no network)
npm run test:rls    # integration: two accounts, isolation, rules (needs .env.test)
```
`.env.test` (local only) needs `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`. The secret key bypasses RLS and is used only by the test to create and delete throwaway users. Do not point tests at production.

## Security model
- Browser and server code use only the publishable key. The secret key is never in app code.
- RLS is on for every table. Users can read and write only rows where `user_id = auth.uid()`.
- Journeys and tasks are created only by the `upsert_journey()` database function. Users can update only `status`, `notes`, and `evidence_note` on their tasks (column-level grant).
- Triggers enforce: no self-completion of third-party steps (sponsor approval, documents issued, visa decision), evidence before completion where required, and dependencies before completion.
- Template tasks live in separate tables; new template versions add tasks without deleting a user's progress.
- Do not collect passports, financial records, or other sensitive documents yet. Storage buckets come with Milestone 4.

## Deploy (Vercel)
Import the GitHub repo, set the three `NEXT_PUBLIC_*` variables, set `NEXT_PUBLIC_SITE_URL` to the deployed URL, add that URL to Supabase redirect URLs, and update the email template links if you use a custom domain.

## Milestone 2: sponsor comparison (additive)
Follow `docs/INSTALL-PATHWISE-DEV.md` (backup, snapshot, install, verify, rollback). In short, in the SQL Editor and in this order, never re-running 0001 or 0002:
1. `supabase/migrations/0003_sponsors.sql` (skip if already applied)
2. `supabase/migrations/0004_sponsor_refinements.sql`
3. `supabase/seeds/sponsors.generated.sql` (safe to re-run)

Then open `/sponsors`. No secret keys are needed for any of this.

### Adding or updating sponsor data (admin workflow)
Sponsor facts live as JSON in `data/sponsors/*.json` and `data/government-fees.json`, so every change goes through GitHub review.
1. Edit or add a JSON file (copy `interexchange.json`). Every fee schedule needs a `source`, and every source needs a `verified_at` date.
2. Unknown means unknown: use `null` or leave the item out. Never use 0 or `false` as a guess.
3. Run `node scripts/sponsors-to-sql.mjs`. It checks the data and rewrites `supabase/seeds/sponsors.generated.sql`.
4. Paste that file into the Supabase SQL Editor and run it. The editor runs as admin; the app's keys cannot write sponsor data.
5. To publish, set `record_status` to `verified` and `is_published` to `true`. Draft records stay hidden by Row Level Security.
Do not scrape sponsor sites automatically; read the page, then enter what it says. Re-check records older than about 90 days.

### Tests added
`npm test` now also covers the cost engine (no double counting, unknown costs, ranking, residence schedules) and sponsor matching. `npm run test:rls` also covers sponsor visibility, write protection, saved-sponsor isolation, persistence, and the preferred-sponsor rules.

## Status
Milestone 1 was run successfully by the owner. Milestone 2 is written but not yet run (the cost engine and data generator were executed here with Node). First run: `npm install`, `npm run typecheck`, `npm test`, migrations, then `npm run test:rls`. Fix anything that fails before building Milestone 2.
