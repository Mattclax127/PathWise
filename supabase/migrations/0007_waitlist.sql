-- PathWise validation test: waitlist + eligibility self-check answers. ADDITIVE ONLY (new table). Review before running.
-- Anyone (including signed-out visitors) may INSERT one row; nobody can read the list through the public API (view it in the Supabase dashboard).
create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null check (char_length(email) between 5 and 254 and email = lower(email)),
  consent boolean not null check (consent = true),
  fit_result text not null check (fit_result in ('intern','trainee','unsure')),
  residence text, applicant_status text, english text, duration_months int check (duration_months between 1 and 24),
  field text, host_state text, sponsor_state text, willing_to_pay text, source text
);
create unique index if not exists waitlist_signups_email_key on public.waitlist_signups (email);
alter table public.waitlist_signups enable row level security;
drop policy if exists "anyone can join the waitlist" on public.waitlist_signups;
create policy "anyone can join the waitlist" on public.waitlist_signups for insert to anon, authenticated with check (consent = true);
grant insert on public.waitlist_signups to anon, authenticated;
