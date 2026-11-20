#!/bin/sh

set -e

echo "Iniciando o script de entrada (entrypoint)..."

# Ensure required storage directories exist (volume may be freshly mounted)
mkdir -p /app/storage/logs /app/storage/kb_uploads

# Wait for Redis to be reachable before booting anything that opens a BullMQ
# connection. `depends_on: condition: service_healthy` only gates a clean
# `up --recreate`; it is NOT re-checked on `docker compose restart` or a
# `restart: unless-stopped` bounce, so without this the app can race Docker's
# DNS (EAI_AGAIN) or dial a restarted Redis container's stale IP (ECONNREFUSED).
# This isn't load-bearing since legacy installs used a mounted entrypoint script
# that may override this script, but it's a cost-nothing check for newer installs.
# The real check is done by the application itself, but this provides a safety net.
REDIS_HOST="${REDIS_HOST:-redis}"
REDIS_PORT="${REDIS_PORT:-6379}"
echo "Aguardando o Redis em ${REDIS_HOST}:${REDIS_PORT}..."
for i in $(seq 1 60); do
  if node -e "const net=require('net');const s=net.connect(Number(process.env.REDIS_PORT||6379),process.env.REDIS_HOST||'redis');let done=false;const finish=(code)=>{if(done)return;done=true;s.destroy();process.exit(code)};s.setTimeout(1000,()=>finish(1));s.on('connect',()=>finish(0));s.on('error',()=>finish(1));" 2>/dev/null; then
    echo "O Redis está no ar!"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "Tempo esgotado aguardando o Redis em ${REDIS_HOST}:${REDIS_PORT}" >&2
    exit 1
  fi
  sleep 1
done

# Run AdonisJS migrations
echo "Executando as migrations do AdonisJS..."
node ace migration:run --force

# Seed the database if needed
echo "Populando o banco de dados (seed)..."
node ace db:seed

# Start background workers for all queues
echo "Iniciando os workers em segundo plano de todas as filas..."
node ace queue:work --all &

# Start the AdonisJS application
echo "Iniciando o aplicativo AdonisJS..."
exec node bin/server.js
