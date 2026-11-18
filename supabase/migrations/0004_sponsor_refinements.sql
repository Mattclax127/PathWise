-- PathWise Milestone 2, part 2 (additive). Run AFTER 0003_sponsors.sql. Safe whether or not 0003 was already applied.
-- Only adds columns to the Milestone 2 sponsor tables. Touches no Milestone 1 table and deletes nothing.

-- How a program's designation was confirmed. 'state_directory' = we saw the sponsor in the State Department list.
-- 'sponsor_statement' = the sponsor's own official site says so; confirm on j1visa.state.gov. Shown to applicants.
alter table public.sponsor_programs
  add column if not exists designation_evidence text not null default 'sponsor_statement'
  check (designation_evidence in ('state_directory','sponsor_statement'));

-- Some sponsors price by student status (e.g. current student vs graduate). null = applies to everyone.
alter table public.sponsor_fee_schedules
  add column if not exists applies_to_education text[];

-- Components in the same choice_group are alternatives (e.g. insurance plans). The engine uses the lowest-priced one
-- and says so; it never adds them together.
alter table public.sponsor_fee_components
  add column if not exists choice_group text;
