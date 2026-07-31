#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

COMMIT_SHA="${1:-}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-${REPO_ROOT}/infrastructure/docker/docker-compose.production.yml}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-edumall-career-production}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-300}"
PRODUCTION_WEB_URL="https://career.theedumall.com"
PRODUCTION_API_URL="https://career.theedumall.com/api"

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
  PILOT_MODE
  PUBLIC_REGISTRATION_ENABLED
  ASSESSMENT_DELIVERY_ENABLED
  REPORT_WORKER_CONCURRENCY
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

load_and_validate_env() {
  [[ -f "${ENV_FILE}" ]] || fail "Environment file not found: ${ENV_FILE}"
  [[ -r "${ENV_FILE}" ]] || fail "Environment file is not readable: ${ENV_FILE}"

  set -a
  # shellcheck disable=SC1090
  . "${ENV_FILE}"
  set +a
  export APP_VERSION="${COMMIT_SHA}"

  for variable_name in "${REQUIRED_ENV_VARS[@]}"; do
    [[ -n "${!variable_name:-}" ]] || fail "Required variable is missing or empty: ${variable_name}"
  done

  for variable_name in "${REQUIRED_ENV_VARS[@]}"; do
    [[ "${variable_name}" == "APP_VERSION" ]] && continue
    case "${!variable_name}" in
      replace-with* | *"replace-with"* | *"example.com"*)
        fail "Placeholder value still present for ${variable_name}"
        ;;
    esac
  done

  [[ "${NODE_ENV}" == "production" ]] || fail "NODE_ENV must be production"
  [[ "${APP_ENV}" == "production" ]] || fail "APP_ENV must be production"
  [[ "${PUBLIC_WEB_URL}" == "${PRODUCTION_WEB_URL}" ]] || fail "PUBLIC_WEB_URL must be ${PRODUCTION_WEB_URL}"
  [[ "${PUBLIC_API_URL}" == "${PRODUCTION_API_URL}" ]] || fail "PUBLIC_API_URL must be ${PRODUCTION_API_URL}"
  [[ "${CORS_ALLOWED_ORIGINS}" == "${PRODUCTION_WEB_URL}" ]] || fail "CORS_ALLOWED_ORIGINS must be ${PRODUCTION_WEB_URL}"
  [[ "${PILOT_MODE}" == "true" ]] || fail "PILOT_MODE must stay true until CTO approval"
  [[ "${PUBLIC_REGISTRATION_ENABLED}" == "false" ]] || fail "PUBLIC_REGISTRATION_ENABLED must stay false until CTO approval"
  [[ "${ASSESSMENT_DELIVERY_ENABLED}" == "false" ]] || fail "ASSESSMENT_DELIVERY_ENABLED must stay false until CTO approval"
  [[ "${REPORT_WORKER_CONCURRENCY}" == "1" ]] || fail "REPORT_WORKER_CONCURRENCY must be 1 on the 4 GB VPS"
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

check_url() {
  local label="$1"
  local url="$2"
  curl --fail --silent --show-error --location --retry 6 --retry-delay 5 --max-time 30 "${url}" >/dev/null
  echo "${label}: ok (${url})"
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
  compose up -d --remove-orphans postgres redis web api worker

  for service_name in postgres redis api worker web; do
    wait_for_service "${service_name}"
  done

  check_url "local web" "http://127.0.0.1:3100"
  check_url "local api health" "http://127.0.0.1:3101/health"
  check_url "local api readiness" "http://127.0.0.1:3101/ready"
  check_url "public web" "${PRODUCTION_WEB_URL}"
  check_url "public api health" "${PRODUCTION_API_URL}/health"

  echo "Deployed commit: ${COMMIT_SHA}"
  compose ps
}

main "$@"
