#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

COMMIT_SHA="${1:-}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env.staging}"
COMPOSE_FILE="${COMPOSE_FILE:-${REPO_ROOT}/infrastructure/docker/docker-compose.staging.yml}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-edumall-career-staging}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-300}"

REQUIRED_ENV_VARS=(
  NODE_ENV
  APP_ENV
  APP_VERSION
  PUBLIC_WEB_URL
  PUBLIC_API_URL
  CORS_ALLOWED_ORIGINS
  POSTGRES_DB
  POSTGRES_USER
  POSTGRES_PASSWORD
  DATABASE_URL
  REDIS_URL
  SESSION_SECRET
  LOG_LEVEL
  CADDY_EMAIL
  STAGING_DOMAIN
)

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

validate_commit_sha() {
  [[ -n "${COMMIT_SHA}" ]] || fail "Usage: $0 <approved-40-character-git-commit-sha>"
  [[ "${COMMIT_SHA}" =~ ^[0-9a-fA-F]{40}$ ]] || fail "Commit must be a full 40-character Git SHA"
}

load_and_validate_env() {
  [[ -f "${ENV_FILE}" ]] || fail "Environment file not found: ${ENV_FILE}"
  [[ -r "${ENV_FILE}" ]] || fail "Environment file is not readable: ${ENV_FILE}"

  set -a
  # shellcheck disable=SC1090
  . "${ENV_FILE}"
  set +a

  for variable_name in "${REQUIRED_ENV_VARS[@]}"; do
    [[ -n "${!variable_name:-}" ]] || fail "Required variable is missing or empty: ${variable_name}"
  done

  for variable_name in "${REQUIRED_ENV_VARS[@]}"; do
    case "${!variable_name}" in
      replace-with* | *"replace-with"* | *"example.com"*)
        fail "Placeholder value still present for ${variable_name}"
        ;;
    esac
  done

  export APP_VERSION="${COMMIT_SHA}"
}

compose() {
  docker compose \
    --env-file "${ENV_FILE}" \
    --project-name "${COMPOSE_PROJECT_NAME}" \
    -f "${COMPOSE_FILE}" \
    "$@"
}

ensure_clean_tracked_tree() {
  git diff --quiet || fail "Tracked working tree changes detected; refusing to deploy"
  git diff --cached --quiet || fail "Staged changes detected; refusing to deploy"
}

checkout_commit_detached() {
  cd "${REPO_ROOT}"
  git fetch --prune origin
  git cat-file -e "${COMMIT_SHA}^{commit}" || fail "Commit does not exist locally after fetch: ${COMMIT_SHA}"
  ensure_clean_tracked_tree
  git checkout --detach "${COMMIT_SHA}"
}

wait_for_service() {
  local service_name="$1"
  local deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
  local container_id=""
  local status=""

  while (( SECONDS < deadline )); do
    container_id="$(compose ps -q "${service_name}")"
    if [[ -n "${container_id}" ]]; then
      status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}" 2>/dev/null || true)"
      if [[ "${status}" == "healthy" || "${status}" == "running" ]]; then
        echo "${service_name}: ${status}"
        return 0
      fi
    fi

    sleep 5
  done

  compose ps
  fail "Timed out waiting for service health: ${service_name}"
}

main() {
  validate_commit_sha
  require_command git
  require_command docker
  require_command curl

  checkout_commit_detached
  load_and_validate_env

  compose config >/dev/null
  compose build --pull web api worker
  compose up -d --remove-orphans

  for service_name in postgres redis api worker web caddy; do
    wait_for_service "${service_name}"
  done

  curl --fail --silent --show-error --retry 6 --retry-delay 5 "${PUBLIC_API_URL%/}/ready" >/dev/null

  echo "Deployed commit: ${COMMIT_SHA}"
  compose ps
}

main "$@"
