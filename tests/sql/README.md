# Database tests (plain Postgres, no Supabase account needed)

These run the real migrations against a **throwaway** local Postgres with a small stand-in for Supabase auth/storage
(`supabase_stub.sql`). Never point them at your PathWise project.

    createdb-less start (example, Postgres 15+ installed locally):  PGURL=postgres://postgres@localhost:5432
    PGURL=... bash tests/sql/run.sh                       # all migrations + applicant A/B/C/D, RLS and external-confirmation scenarios
    PGURL=... bash tests/sql/upgrade_preserves_data.sh    # existing M1/M2 data survives 0005 + 0006 + backfill

Each check prints `ok - ...`; any failure stops the run.
