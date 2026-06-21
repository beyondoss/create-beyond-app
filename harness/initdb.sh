#!/usr/bin/env bash
# Runs once on first DB init (against POSTGRES_DB). Sets up the schemas the
# primitives expect in the shared app database:
#   - auth   : auth server auto-migrates + CREATE EXTENSION beyond_auth (ext is installed in the image)
#   - queue  : schema + PL/pgSQL hot paths (no pgrx extension needed for functionality)
#   - public : the app's Drizzle migrations
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS queue;
SQL

# Queue: base schema then the PL/pgSQL hot-path overrides (search_path=queue).
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c 'SET search_path = queue, public;' -f /opt/queue/schema.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c 'SET search_path = queue, public;' -f /opt/queue/hot_paths.sql

echo "[beyond-init] auth/queue schemas ready in ${POSTGRES_DB}"
