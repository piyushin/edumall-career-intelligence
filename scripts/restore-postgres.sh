#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

BACKUP_PATH="${1:-}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-${REPO_ROOT}/infrastructure/docker/docker-compose.production.yml}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-edumall-career-production}"

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

validate_backup() {
  if [[ "${BACKUP_PATH}" == *.gz ]]; then
    command -v gzip >/dev/null 2>&1 || fail "gzip is required for compressed backups"
    gzip -t "${BACKUP_PATH}"
    gzip -dc "${BACKUP_PATH}" | compose exec -T postgres pg_restore --list >/dev/null
  else
    compose exec -T postgres pg_restore --list < "${BACKUP_PATH}" >/dev/null
  fi
}

restore_backup() {
  if [[ "${BACKUP_PATH}" == *.gz ]]; then
    gzip -dc "${BACKUP_PATH}" | compose exec -T postgres pg_restore \
      --clean \
      --if-exists \
      --no-owner \
      --no-privileges \
      --username "${POSTGRES_USER}" \
      --dbname "${POSTGRES_DB}"
  else
    compose exec -T postgres pg_restore \
      --clean \
      --if-exists \
      --no-owner \
      --no-privileges \
      --username "${POSTGRES_USER}" \
      --dbname "${POSTGRES_DB}" \
      < "${BACKUP_PATH}"
  fi
}

main() {
  command -v docker >/dev/null 2>&1 || fail "docker is required"
  [[ -n "${BACKUP_PATH}" ]] || fail "Usage: $0 <postgres-backup.dump-or-dump.gz>"
  [[ -f "${BACKUP_PATH}" ]] || fail "Backup file not found: ${BACKUP_PATH}"
  [[ -r "${BACKUP_PATH}" ]] || fail "Backup file is not readable: ${BACKUP_PATH}"
  [[ -f "${ENV_FILE}" ]] || fail "Environment file not found: ${ENV_FILE}"

  set -a
  # shellcheck disable=SC1090
  . "${ENV_FILE}"
  set +a

  [[ -n "${POSTGRES_DB:-}" ]] || fail "POSTGRES_DB is required"
  [[ -n "${POSTGRES_USER:-}" ]] || fail "POSTGRES_USER is required"

  validate_backup

  echo "This restore is destructive for database ${POSTGRES_DB} and requires application downtime."
  echo "Application containers will be stopped; PostgreSQL and Redis volumes are preserved."
  echo "Host Nginx is not modified by this script."
  read -r -p "Type RESTORE ${POSTGRES_DB} to continue: " confirmation
  [[ "${confirmation}" == "RESTORE ${POSTGRES_DB}" ]] || fail "Restore confirmation did not match"

  compose stop web api worker
  restore_backup
  compose up -d web api worker

  echo "Restore completed from: ${BACKUP_PATH}"
  echo "Run scripts/health-check-production.sh and inspect application logs before reopening production."
}

main "$@"
