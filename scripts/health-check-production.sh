#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-${REPO_ROOT}/infrastructure/docker/docker-compose.production.yml}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-edumall-career-production}"
PRODUCTION_WEB_URL="https://career.theedumall.com"
PRODUCTION_API_URL="https://career.theedumall.com/api"

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

  [[ "${PUBLIC_WEB_URL:-}" == "${PRODUCTION_WEB_URL}" ]] || fail "PUBLIC_WEB_URL must be ${PRODUCTION_WEB_URL}"
  [[ "${PUBLIC_API_URL:-}" == "${PRODUCTION_API_URL}" ]] || fail "PUBLIC_API_URL must be ${PRODUCTION_API_URL}"

  check_url "local web" "http://127.0.0.1:3100"
  check_url "local web status" "http://127.0.0.1:3100/status"
  check_url "local api health" "http://127.0.0.1:3101/health"
  check_url "local api readiness" "http://127.0.0.1:3101/ready"
  check_url "public web" "${PRODUCTION_WEB_URL}"
  check_url "public api health" "${PRODUCTION_API_URL}/health"
  check_url "public api readiness" "${PRODUCTION_API_URL}/ready"

  if command -v docker >/dev/null 2>&1 && [[ -f "${COMPOSE_FILE}" ]]; then
    compose ps
  fi
}

main "$@"
