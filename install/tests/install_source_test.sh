#!/bin/bash
#
# install_source_test.sh
#
# Where the installer (install_nomad.sh) and the updater fixes (run_updater_fixes.sh) download their files
# from: by default the latest PUBLISHED RELEASE of this distribution (so the compose file and scripts match
# the images that release built), a pinned release with NOMAD_RELEASE_TAG, or a development branch only when
# NOMAD_GITHUB_BRANCH is set explicitly. curl is stubbed: no network.
#
# Usage:  bash install/tests/install_source_test.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALLER="${SCRIPT_DIR}/../install_nomad.sh"
UPDATER_FIXES="${SCRIPT_DIR}/../run_updater_fixes.sh"
OUT="$(mktemp)"
failures=0

fail() { printf 'not ok - %s\n' "$1"; failures=$((failures + 1)); }
pass() { printf 'ok - %s\n' "$1"; }

# Runs resolve_nomad_source from <script> in a clean subshell with the given environment, then prints the
# resulting base URL. The function is extracted with sed so run_updater_fixes.sh (no main guard) is not run.
resolve_with() {
  local script="$1"
  shift
  (
    unset NOMAD_RELEASE_TAG NOMAD_GITHUB_BRANCH NOMAD_GITHUB_REPO
    RED='' YELLOW='' RESET=''
    for assignment in "$@"; do export "${assignment?}"; done
    NOMAD_GITHUB_REPO="${NOMAD_GITHUB_REPO:-jhonatanoliveira2/monolith-nomad}"
    # GitHub API stub: answers like /releases/latest unless LATEST_TAG is empty
    curl() {
      echo "curl $*" >>"${OUT}.calls"
      if [[ -n "${LATEST_TAG:-}" ]]; then
        printf '{\n  "url": "x",\n  "tag_name": "%s",\n  "name": "Release"\n}\n' "$LATEST_TAG"
      else
        return 22
      fi
    }
    # shellcheck disable=SC1090
    source <(sed -n '/^resolve_nomad_source() {/,/^}/p' "$script")
    resolve_nomad_source || exit 1
    echo "BASE=${NOMAD_RAW_BASE_URL}"
    [[ -n "${MANAGEMENT_COMPOSE_FILE_URL:-}" ]] && echo "COMPOSE=${MANAGEMENT_COMPOSE_FILE_URL}"
    [[ -n "${SIDECAR_SCRIPT_URL:-}" ]] && echo "SIDECAR=${SIDECAR_SCRIPT_URL}"
    exit 0
  ) >"$OUT" 2>&1
}

expect() {
  local description="$1" status="$2" pattern="$3"
  shift 3
  rm -f "${OUT}.calls"
  resolve_with "$@"
  local got=$?
  if [[ "$got" -eq "$status" ]] && grep -Eq "$pattern" "$OUT"; then
    pass "$description"
  else
    fail "$description (exit $got)"
    sed 's/^/    /' "$OUT"
  fi
}

for script in "$INSTALLER" "$UPDATER_FIXES"; do
  name="$(basename "$script")"
  base='https://raw\.githubusercontent\.com/jhonatanoliveira2/monolith-nomad'

  if grep -q '^resolve_nomad_source() {' "$script"; then
    pass "$name defines resolve_nomad_source"
  else
    fail "$name defines resolve_nomad_source"
    continue
  fi

  expect "$name: latest published release by default" 0 "BASE=${base}/refs/tags/v1\.36\.0$" \
    "$script" LATEST_TAG=v1.36.0
  expect "$name: NOMAD_RELEASE_TAG pins a release" 0 "BASE=${base}/refs/tags/v1\.35\.2-rc\.1$" \
    "$script" NOMAD_RELEASE_TAG=v1.35.2-rc.1
  if [[ ! -e "${OUT}.calls" ]]; then
    pass "$name: a pinned release does not query the API"
  else
    fail "$name: a pinned release does not query the API"
  fi
  expect "$name: NOMAD_GITHUB_BRANCH is an explicit development opt-in" 0 "BASE=${base}/refs/heads/dev$" \
    "$script" NOMAD_GITHUB_BRANCH=dev
  expect "$name: no published release is a clear error, not a silent fallback to main" 1 \
    "Nenhuma release publicada" "$script" LATEST_TAG=
  expect "$name: a malformed tag is refused" 1 "inválid" "$script" 'NOMAD_RELEASE_TAG=v1.0.0;rm'
  expect "$name: a malformed repository is refused" 1 "inválid" \
    "$script" 'NOMAD_GITHUB_REPO=a/b/../c' LATEST_TAG=v1.0.0
  expect "$name: a malformed branch is refused" 1 "inválid" "$script" 'NOMAD_GITHUB_BRANCH=main;id'
  for bad in '-x' 'a//b' 'dev/' '/dev' 'feat/../main'; do
    expect "$name: branch '$bad' is refused" 1 "inválid" "$script" "NOMAD_GITHUB_BRANCH=$bad"
  done
  expect "$name: a nested branch name is accepted" 0 "BASE=${base}/refs/heads/feat/x-1$" \
    "$script" NOMAD_GITHUB_BRANCH=feat/x-1
  expect "$name: the no-release message mentions the API rate limit" 1 \
    "limite de requisições" "$script" LATEST_TAG=
  expect "$name: the no-release message points to NOMAD_RELEASE_TAG" 1 \
    "NOMAD_RELEASE_TAG=vX\\.Y\\.Z" "$script" LATEST_TAG=
  if grep -q -- '--max-time' <(sed -n '/^resolve_nomad_source() {/,/^}/p' "$script"); then
    pass "$name: the API call has a total time limit"
  else
    fail "$name: the API call has a total time limit"
  fi
done

expect "install_nomad.sh: every download URL follows the resolved release" 0 \
  "COMPOSE=https://raw\.githubusercontent\.com/jhonatanoliveira2/monolith-nomad/refs/tags/v1\.36\.0/install/management_compose\.yaml" \
  "$INSTALLER" LATEST_TAG=v1.36.0
expect "run_updater_fixes.sh: every download URL follows the resolved release" 0 \
  "SIDECAR=https://raw\.githubusercontent\.com/jhonatanoliveira2/monolith-nomad/refs/tags/v1\.36\.0/install/sidecar-updater/update-watcher\.sh" \
  "$UPDATER_FIXES" LATEST_TAG=v1.36.0

for script in "$INSTALLER" "$UPDATER_FIXES"; do
  if grep -Eq '^NOMAD_RAW_BASE_URL=.*refs/heads' "$script"; then
    fail "$(basename "$script"): no top-level default to a moving branch"
  else
    pass "$(basename "$script"): no top-level default to a moving branch"
  fi
done

rm -f "$OUT" "${OUT}.calls"
if ((failures > 0)); then
  printf '\n%d test(s) failed\n' "$failures"
  exit 1
fi
printf '\nall tests passed\n'
