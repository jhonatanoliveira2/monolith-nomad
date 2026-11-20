#!/bin/bash
#
# Runs the whole admin test suite in the project's runtime, the same base as the production image:
# Node 22.23.5 with the native addons built (`docker build --target deps`), plus throwaway MySQL and Redis on a
# private Docker network for the specs that boot the app (`npm run test:app`). Nothing is published and every
# container is removed at the end. The host's admin/node_modules is not used.
#
# Usage (repository root):  bash scripts/test-in-docker.sh [unit|app|all]   (default: all)

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

WHAT="${1:-all}"
IMAGE="${IMAGE:-monolith-nomad:test-deps}"
NET="mntest-tests-$$"
TIMEOUT="${TEST_TIMEOUT:-900}"

cleanup() {
  docker rm -f "${NET}-mysql" "${NET}-redis" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "# building ${IMAGE} (Dockerfile target: deps)"
docker build --quiet --target deps -t "$IMAGE" . >/dev/null

docker network create "$NET" >/dev/null
if [[ "$WHAT" != "unit" ]]; then
  docker run -d --name "${NET}-redis" --network "$NET" redis:7-alpine >/dev/null
  docker run -d --name "${NET}-mysql" --network "$NET" \
    -e MYSQL_ROOT_PASSWORD=nomad_test -e MYSQL_DATABASE=nomad_test \
    -e MYSQL_USER=nomad_test -e MYSQL_PASSWORD=nomad_test mysql:8.0 >/dev/null
  echo "# waiting for MySQL"
  for _ in $(seq 1 90); do
    docker exec "${NET}-mysql" mysql -unomad_test -pnomad_test -e 'select 1' nomad_test >/dev/null 2>&1 && break
    sleep 2
  done
fi

# --init + timeout -k: a hung runner (e.g. waiting for a service) is killed with all its children
timeout -k 15 "$TIMEOUT" docker run --rm --init --network "$NET" \
  -e REDIS_HOST="${NET}-redis" -e DB_HOST="${NET}-mysql" -e WHAT="$WHAT" \
  -v "$PWD:/src:ro" "$IMAGE" bash -c '
    set -uo pipefail
    mkdir -p /work
    tar -C /src --exclude=./admin/node_modules --exclude=./admin/build -cf - . | tar -C /work -xf -
    ln -s /app/node_modules /work/admin/node_modules
    cd /work/admin
    status=0
    if [[ "$WHAT" != "app" ]]; then
      echo "# npm run test:unit (node $(node --version))"
      npm run --silent test:unit || status=1
    fi
    if [[ "$WHAT" != "unit" ]]; then
      echo "# migrations"
      NODE_ENV=test node ace migration:run --force >/dev/null || { echo "migrations failed"; exit 1; }
      echo "# npm run test:app"
      LOG_LEVEL=silent npm run --silent test:app || status=1
    fi
    exit $status'
