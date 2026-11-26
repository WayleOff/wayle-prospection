#!/usr/bin/env bash
# Lance migration + seed + tests sur une base jetable : ./supabase/tests/run.sh  (variables PGHOST, PGPORT, PGUSER comme psql)
set -euo pipefail
cd "$(dirname "$0")"
DB="wayle_test_$$"
psql -q -d postgres -v ON_ERROR_STOP=1 -c "create database $DB"
trap 'psql -q -d postgres -c "drop database if exists $DB" >/dev/null' EXIT
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f setup_stub.sql
for f in ../migrations/*.sql; do psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$f" 2>&1 | grep -v NOTICE || true; done
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f ../seed.sql
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f schema_test.sql 2>&1 | grep -E "ÉCHEC|ERROR|PASSENT" || true
