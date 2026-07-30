#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env.staging}"
COMPOSE_FILE="${COMPOSE_FILE:-${REPO_ROOT}/infrastructure/docker/docker-compose.staging.yml}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-edumall-career-staging}"
BACKUP_DIR="${BACKUP_DIR:-/opt/edumall-career/backups/postgres}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

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
  [[ -f "${ENV_FILE}" ]] || fail "Environment file not found: ${ENV_FILE}"

  set -a
  # shellcheck disable=SC1090
  . "${ENV_FILE}"
  set +a

  [[ -n "${POSTGRES_DB:-}" ]] || fail "POSTGRES_DB is required"
  [[ -n "${POSTGRES_USER:-}" ]] || fail "POSTGRES_USER is required"

  umask 077
  mkdir -p "${BACKUP_DIR}"
  chmod 700 "${BACKUP_DIR}"

  local backup_path="${BACKUP_DIR}/postgres-${POSTGRES_DB}-${TIMESTAMP}.dump"
  local tmp_path="${backup_path}.tmp"

  compose exec -T postgres pg_dump \
    --username "${POSTGRES_USER}" \
    --dbname "${POSTGRES_DB}" \
    --format custom \
    --no-owner \
    --no-privileges \
    > "${tmp_path}"

  compose exec -T postgres pg_restore --list < "${tmp_path}" >/dev/null

  mv "${tmp_path}" "${backup_path}"
  chmod 600 "${backup_path}"

  echo "Backup created: ${backup_path}"
  echo "Retention guidance: review old backups regularly, keep only approved recovery windows, and remove expired files with shred/rm under an approved retention policy."
}

main "$@"
