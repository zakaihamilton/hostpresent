#!/usr/bin/env bash

set -euo pipefail

if [[ -z "${APP_URL:-}" ]]; then
  echo "Set APP_URL to the Preview or Production deployment origin." >&2
  exit 1
fi

app_url="${APP_URL%/}"

verify_limit() {
  local label="$1"
  local requests="$2"
  shift 2

  local status_file
  status_file="$(mktemp)"
  local attempt
  for ((attempt = 1; attempt <= requests; attempt += 1)); do
    curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' "$@" >>"$status_file" &
  done
  wait

  local rate_limited_count
  rate_limited_count="$(grep -cx '429' "$status_file" || true)"
  rm -f "$status_file"

  if [[ "$rate_limited_count" == "0" ]]; then
    echo "${label}: expected at least one 429 after ${requests} requests." >&2
    exit 1
  fi

  echo "${label}: verified (${rate_limited_count} rate-limited responses)."
}

# Invalid request bodies and credentials keep the checks from creating or
# joining a room. Invalid diagnostic requests are rejected before being logged.
verify_limit \
  "Create room" \
  11 \
  -X POST \
  -H "Content-Type: text/plain" \
  --data 'invalid' \
  "${app_url}/api/rooms"
verify_limit \
  "Resolve room code" \
  21 \
  -X POST \
  -H "Content-Type: application/json" \
  --data '{"code":"INVALID"}' \
  "${app_url}/api/rooms/resolve"
verify_limit \
  "Room state" \
  121 \
  -H "Authorization: Bearer invalid" \
  "${app_url}/api/rooms/state"
verify_limit \
  "TURN configuration" \
  121 \
  -H "x-room-token: invalid" \
  "${app_url}/api/media/ice-config"
verify_limit \
  "Diagnostics" \
  21 \
  -X POST \
  -H "Content-Type: text/plain" \
  --data 'invalid' \
  "${app_url}/api/diagnostics"
