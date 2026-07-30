#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

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

check_url() {
  local label="$1"
  local url="$2"
  curl --fail --silent --show-error --location --max-time 20 "${url}" >/dev/null
  echo "${label}: ok (${url})"
}

main() {
  command -v curl >/dev/null 2>&1 || fail "curl is required"
  [[ -f "${ENV_FILE}" ]] || fail "Environment file not found: ${ENV_FILE}"

  set -a
  # shellcheck disable=SC1090
  . "${ENV_FILE}"
  set +a

  [[ -n "${PUBLIC_WEB_URL:-}" ]] || fail "PUBLIC_WEB_URL is required"
  [[ -n "${PUBLIC_API_URL:-}" ]] || fail "PUBLIC_API_URL is required"

  check_url "web" "${PUBLIC_WEB_URL%/}/status"
  check_url "api health" "${PUBLIC_API_URL%/}/health"
  check_url "api readiness" "${PUBLIC_API_URL%/}/ready"

  if command -v docker >/dev/null 2>&1 && [[ -f "${COMPOSE_FILE}" ]]; then
    compose ps
  fi
}

main "$@"
