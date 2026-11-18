#!/usr/bin/env bash
# Usage: PGURL=postgres://user@host:port bash tests/sql/run.sh   (a THROWAWAY Postgres with a Supabase auth/storage stub)
set -e
cd "$(dirname "$0")/../.."
P="psql $PGURL/pw_test -v ON_ERROR_STOP=1 -q -t -A"
psql "$PGURL/postgres" -q -c "drop database if exists pw_test" -c "create database pw_test"
$P -f tests/sql/supabase_stub.sql
for f in supabase/migrations/000*.sql; do $P -f "$f"; done
$P -f tests/sql/engine_scenarios.sql 2>&1 | grep -E "FAIL|ERROR|PASSED|NOTICE:  ok" | sed 's/^psql:[^ ]* NOTICE:  //'
