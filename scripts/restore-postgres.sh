#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

BACKUP_PATH="${1:-}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env.staging}"
COMPOSE_FILE="${COMPOSE_FILE:-${REPO_ROOT}/infrastructure/docker/docker-compose.staging.yml}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-edumall-career-staging}"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

compose() {
  docker compose \
    --env-file "${ENV_FILE}" \
    --project-name "${COMPOSE_PROJECT_NAME}" \
    -f "${COMPOSE_FILE}" \
    "$@"
}

main() {
  command -v docker >/dev/null 2>&1 || fail "docker is required"
  [[ -n "${BACKUP_PATH}" ]] || fail "Usage: $0 <postgres-backup.dump>"
  [[ -f "${BACKUP_PATH}" ]] || fail "Backup file not found: ${BACKUP_PATH}"
  [[ -r "${BACKUP_PATH}" ]] || fail "Backup file is not readable: ${BACKUP_PATH}"
  [[ -f "${ENV_FILE}" ]] || fail "Environment file not found: ${ENV_FILE}"

  set -a
  # shellcheck disable=SC1090
  . "${ENV_FILE}"
  set +a

  [[ -n "${POSTGRES_DB:-}" ]] || fail "POSTGRES_DB is required"
  [[ -n "${POSTGRES_USER:-}" ]] || fail "POSTGRES_USER is required"

  compose exec -T postgres pg_restore --list < "${BACKUP_PATH}" >/dev/null

  echo "This restore is destructive for database ${POSTGRES_DB} and requires application downtime."
  echo "Application containers will be stopped; PostgreSQL and Redis volumes are preserved."
  read -r -p "Type RESTORE ${POSTGRES_DB} to continue: " confirmation
  [[ "${confirmation}" == "RESTORE ${POSTGRES_DB}" ]] || fail "Restore confirmation did not match"

  compose stop web api worker
  compose exec -T postgres pg_restore \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    --username "${POSTGRES_USER}" \
    --dbname "${POSTGRES_DB}" \
    < "${BACKUP_PATH}"

  compose up -d web api worker caddy

  echo "Restore completed from: ${BACKUP_PATH}"
  echo "Run scripts/health-check-staging.sh and inspect application logs before reopening staging to reviewers."
}

main "$@"
