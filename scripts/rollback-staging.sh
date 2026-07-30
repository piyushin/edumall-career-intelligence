#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

ROLLBACK_COMMIT_SHA="${1:-}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env.staging}"
COMPOSE_FILE="${COMPOSE_FILE:-${REPO_ROOT}/infrastructure/docker/docker-compose.staging.yml}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-edumall-career-staging}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-300}"

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

validate_commit_sha() {
  [[ -n "${ROLLBACK_COMMIT_SHA}" ]] || fail "Usage: $0 <previous-40-character-git-commit-sha>"
  [[ "${ROLLBACK_COMMIT_SHA}" =~ ^[0-9a-fA-F]{40}$ ]] || fail "Rollback commit must be a full 40-character Git SHA"
}

load_env() {
  [[ -f "${ENV_FILE}" ]] || fail "Environment file not found: ${ENV_FILE}"
  set -a
  # shellcheck disable=SC1090
  . "${ENV_FILE}"
  set +a
  export APP_VERSION="${ROLLBACK_COMMIT_SHA}"
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
  command -v git >/dev/null 2>&1 || fail "git is required"
  command -v docker >/dev/null 2>&1 || fail "docker is required"
  command -v curl >/dev/null 2>&1 || fail "curl is required"
  validate_commit_sha

  cd "${REPO_ROOT}"
  git fetch --prune origin
  git cat-file -e "${ROLLBACK_COMMIT_SHA}^{commit}" || fail "Commit does not exist locally after fetch: ${ROLLBACK_COMMIT_SHA}"
  git diff --quiet || fail "Tracked working tree changes detected; refusing rollback"
  git diff --cached --quiet || fail "Staged changes detected; refusing rollback"
  git checkout --detach "${ROLLBACK_COMMIT_SHA}"

  load_env
  compose config >/dev/null
  compose build web api worker
  compose up -d --no-deps web api worker caddy

  for service_name in api worker web caddy; do
    wait_for_service "${service_name}"
  done

  curl --fail --silent --show-error --retry 6 --retry-delay 5 "${PUBLIC_API_URL%/}/ready" >/dev/null

  echo "Rollback commit: ${ROLLBACK_COMMIT_SHA}"
  echo "Database and Redis volumes were preserved."
  compose ps
}

main "$@"
