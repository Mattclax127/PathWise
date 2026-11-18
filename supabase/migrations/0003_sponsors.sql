-- PathWise Milestone 2 (additive): sponsor database, fee schedules, government fees, saved sponsors.
-- Does not modify any Milestone 1 table. Safe to run once on top of 0001 and 0002.

create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  website_url text,
  contact_email text,
  contact_phone text,
  address text,
  designation_source_url text,
  designation_verified_at date,
  record_status text not null default 'needs_review' check (record_status in ('draft','needs_review','verified','stale','retired')),
  is_published boolean not null default false,
  is_sample boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger sponsors_updated before update on public.sponsors for each row execute function public.set_updated_at();

create table public.sponsor_sources (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  url text not null,
  info_type text not null check (info_type in ('designation','fees','services','self_placement','requirements','program')),
  verified_at date not null,
  review_status text not null default 'needs_review' check (review_status in ('verified','needs_review','stale')),
  reviewer text,
  note text,
  created_at timestamptz not null default now(),
  unique (sponsor_id, url, info_type)
);

create table public.sponsor_programs (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  category text not null check (category in ('intern','trainee')),
  fields text[] not null default '{}',                 -- State occupational fields; empty = unknown
  min_duration_months int check (min_duration_months > 0),
  max_duration_months int check (max_duration_months > 0), -- null = unknown
  record_status text not null default 'needs_review' check (record_status in ('draft','needs_review','verified','stale','retired')),
  designation_source_id uuid references public.sponsor_sources(id) on delete set null,
  verified_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sponsor_id, category),
  check (min_duration_months is null or max_duration_months is null or min_duration_months <= max_duration_months)
);
create trigger sponsor_programs_updated before update on public.sponsor_programs for each row execute function public.set_updated_at();

create table public.sponsor_policies (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  policy_key text not null check (policy_key in ('self_placement')),
  value text not null default 'unknown' check (value in ('accepted','required','conditional','not_accepted','unknown')),
  detail text,
  source_id uuid references public.sponsor_sources(id) on delete set null,
  review_status text not null default 'needs_review' check (review_status in ('verified','needs_review','stale')),
  verified_at date,
  unique (sponsor_id, policy_key)
);

create table public.sponsor_requirements (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  category text check (category in ('intern','trainee')),   -- null = applies to all programs
  requirement_type text not null check (requirement_type in ('eligibility','program_rule','document','host','nationality_restriction','other')),
  description text not null,
  countries text[],                                           -- for nationality_restriction
  country_mode text check (country_mode in ('only','excluded')),
  source_id uuid references public.sponsor_sources(id) on delete set null,
  review_status text not null default 'needs_review' check (review_status in ('verified','needs_review','stale')),
  verified_at date
);

create table public.sponsor_fee_schedules (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  category text not null check (category in ('intern','trainee')),
  label text not null,
  applies_to_residence text[],                                -- null = default schedule for everyone else
  currency char(3) not null default 'USD',
  is_itemized_complete boolean not null default false,        -- source lists every mandatory charge
  inclusions_confirmed boolean not null default false,        -- source states what the fee includes
  notes text,
  status text not null default 'needs_review' check (status in ('verified','needs_review','stale')),
  verified_at date not null,
  source_id uuid not null references public.sponsor_sources(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index sponsor_fee_schedules_sponsor_idx on public.sponsor_fee_schedules (sponsor_id, category);

create table public.sponsor_fee_components (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.sponsor_fee_schedules(id) on delete cascade,
  component_type text not null check (component_type in ('sponsor_program_fee','processing','sevis_fee','visa_fee','insurance','other_mandatory','optional_service')),
  label text not null,
  amount_cents bigint check (amount_cents >= 0),              -- null = unknown (never 0 for unknown)
  per text not null default 'one_time' check (per in ('one_time','per_month')),
  is_mandatory boolean not null default true,
  duration_min_months int check (duration_min_months > 0),
  duration_max_months int check (duration_max_months > 0),
  notes text,
  check (duration_min_months is null or duration_max_months is null or duration_min_months <= duration_max_months)
);
create index sponsor_fee_components_schedule_idx on public.sponsor_fee_components (schedule_id);

create table public.sponsor_fee_inclusions (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.sponsor_fee_schedules(id) on delete cascade,
  service_key text not null check (service_key in ('ds2019','sevis_fee','visa_fee','insurance','support','orientation','placement','other')),
  detail text,
  unique (schedule_id, service_key)
);

create table public.government_fees (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  amount_cents bigint check (amount_cents >= 0),
  currency char(3) not null default 'USD',
  applies_to_categories text[] not null default '{intern,trainee}',
  included_in_comparison boolean not null default true,
  source_url text not null,
  verified_at date not null,
  review_status text not null default 'needs_review' check (review_status in ('verified','needs_review','stale')),
  note text,
  created_at timestamptz not null default now()
);

-- User-owned shortlist -------------------------------------------------------------
create table public.journey_sponsor_options (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.journeys(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  status text not null default 'saved' check (status in ('saved','shortlisted','preferred')),
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (journey_id, sponsor_id)
);
create unique index one_preferred_sponsor_per_journey on public.journey_sponsor_options (journey_id) where status = 'preferred';
create index journey_sponsor_options_user_idx on public.journey_sponsor_options (user_id);
create trigger journey_sponsor_options_updated before update on public.journey_sponsor_options for each row execute function public.set_updated_at();

-- Choosing a preferred sponsor only moves "Choose a sponsor" to in progress. It never completes
-- anything, and never touches third-party confirmation steps.
create or replace function public.on_preferred_sponsor() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'preferred' then
    update public.journey_tasks set status = 'in_progress'
      where journey_id = new.journey_id and template_task_key = 'select_sponsor' and status = 'not_started' and is_applicable;
    insert into public.activity_events (user_id, journey_id, event_type, payload)
      values (new.user_id, new.journey_id, 'sponsor_preferred', jsonb_build_object('sponsor_id', new.sponsor_id));
  end if;
  return new;
end $$;
revoke all on function public.on_preferred_sponsor() from public, anon, authenticated;
create trigger journey_sponsor_options_preferred after insert or update of status on public.journey_sponsor_options
  for each row execute function public.on_preferred_sponsor();

-- One transaction: demote any current preferred sponsor, then set the new one (runs as the caller, so RLS applies).
create or replace function public.set_preferred_sponsor(p_sponsor_id uuid) returns void language plpgsql set search_path = '' as $$
declare j uuid; uid uuid := auth.uid();
begin
  select id into j from public.journeys where user_id = uid;
  if j is null then raise exception 'Create your journey first.'; end if;
  update public.journey_sponsor_options set status = 'shortlisted' where journey_id = j and status = 'preferred' and sponsor_id <> p_sponsor_id;
  insert into public.journey_sponsor_options (journey_id, user_id, sponsor_id, status) values (j, uid, p_sponsor_id, 'preferred')
    on conflict (journey_id, sponsor_id) do update set status = 'preferred';
end $$;
revoke all on function public.set_preferred_sponsor(uuid) from public, anon;
grant execute on function public.set_preferred_sponsor(uuid) to authenticated;

-- Row Level Security ----------------------------------------------------------------
alter table public.sponsors enable row level security;
alter table public.sponsor_sources enable row level security;
alter table public.sponsor_programs enable row level security;
alter table public.sponsor_policies enable row level security;
alter table public.sponsor_requirements enable row level security;
alter table public.sponsor_fee_schedules enable row level security;
alter table public.sponsor_fee_components enable row level security;
alter table public.sponsor_fee_inclusions enable row level security;
alter table public.government_fees enable row level security;
alter table public.journey_sponsor_options enable row level security;

-- Public data: readable only when the sponsor is published and verified, and the row itself is verified.
create policy sponsors_public on public.sponsors for select to anon, authenticated using (is_published and record_status = 'verified');
create policy sources_public on public.sponsor_sources for select to anon, authenticated using (review_status = 'verified'
  and exists (select 1 from public.sponsors s where s.id = sponsor_id and s.is_published and s.record_status = 'verified'));
create policy programs_public on public.sponsor_programs for select to anon, authenticated using (record_status = 'verified'
  and exists (select 1 from public.sponsors s where s.id = sponsor_id and s.is_published and s.record_status = 'verified'));
create policy policies_public on public.sponsor_policies for select to anon, authenticated using (review_status = 'verified'
  and exists (select 1 from public.sponsors s where s.id = sponsor_id and s.is_published and s.record_status = 'verified'));
create policy requirements_public on public.sponsor_requirements for select to anon, authenticated using (review_status = 'verified'
  and exists (select 1 from public.sponsors s where s.id = sponsor_id and s.is_published and s.record_status = 'verified'));
create policy schedules_public on public.sponsor_fee_schedules for select to anon, authenticated using (status = 'verified'
  and exists (select 1 from public.sponsors s where s.id = sponsor_id and s.is_published and s.record_status = 'verified'));
create policy components_public on public.sponsor_fee_components for select to anon, authenticated using (
  exists (select 1 from public.sponsor_fee_schedules f join public.sponsors s on s.id = f.sponsor_id
          where f.id = schedule_id and f.status = 'verified' and s.is_published and s.record_status = 'verified'));
create policy inclusions_public on public.sponsor_fee_inclusions for select to anon, authenticated using (
  exists (select 1 from public.sponsor_fee_schedules f join public.sponsors s on s.id = f.sponsor_id
          where f.id = schedule_id and f.status = 'verified' and s.is_published and s.record_status = 'verified'));
create policy gov_fees_public on public.government_fees for select to anon, authenticated using (review_status = 'verified');

-- Private data: each user sees and changes only their own saved sponsors, and only for public sponsors.
create policy options_select on public.journey_sponsor_options for select to authenticated using (user_id = (select auth.uid()));
create policy options_insert on public.journey_sponsor_options for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.journeys j where j.id = journey_id and j.user_id = (select auth.uid()))
  and exists (select 1 from public.sponsors s where s.id = sponsor_id and s.is_published and s.record_status = 'verified'));
create policy options_update on public.journey_sponsor_options for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy options_delete on public.journey_sponsor_options for delete to authenticated using (user_id = (select auth.uid()));

-- Privileges: nobody using the browser keys can write sponsor data. Admins use the SQL Editor (see docs).
revoke all on public.sponsors, public.sponsor_sources, public.sponsor_programs, public.sponsor_policies, public.sponsor_requirements,
  public.sponsor_fee_schedules, public.sponsor_fee_components, public.sponsor_fee_inclusions, public.government_fees,
  public.journey_sponsor_options from anon, authenticated;
grant select on public.sponsors, public.sponsor_sources, public.sponsor_programs, public.sponsor_policies, public.sponsor_requirements,
  public.sponsor_fee_schedules, public.sponsor_fee_components, public.sponsor_fee_inclusions, public.government_fees to anon, authenticated;
grant select, insert, delete on public.journey_sponsor_options to authenticated;
grant update (status, notes) on public.journey_sponsor_options to authenticated;
