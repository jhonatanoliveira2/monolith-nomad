#!/bin/bash

# Project NOMAD — Disk Collector Migration Script
#
# Script                | Project NOMAD Disk Collector Migration Script
# Version               | 1.0.0
# Author                | Crosstalk Solutions, LLC
# Website               | https://crosstalksolutions.com
#
# PURPOSE:
#   One-time migration from the host-based disk info collector to the
#   disk-collector Docker sidecar. The old approach used a nohup background
#   process that wrote to /tmp/nomad-disk-info.json, which was bind-mounted
#   into the admin container. This broke on host reboots because /tmp is
#   cleared and Docker would create a directory at the mount point instead of a file.
#
#   The new approach uses a disk-collector sidecar container that reads host
#   disk info via the /:/host:ro,rslave bind-mount pattern (same pattern as Prometheus
#   node-exporter, and no SYS_ADMIN or privileged capabilities required) and writes directly to
#   /opt/project-nomad/storage/nomad-disk-info.json, which the admin container
#   already reads via its existing storage bind-mount. Thus, no admin image update
#   or new volume mounts required.

###############################################################################
# Color Codes
###############################################################################

RESET='\033[0m'
YELLOW='\033[1;33m'
RED='\033[1;31m'
GREEN='\033[1;32m'
WHITE_R='\033[39m'

###############################################################################
# Constants
###############################################################################

NOMAD_DIR="/opt/project-nomad"
COMPOSE_FILE="${NOMAD_DIR}/compose.yml"
COMPOSE_PROJECT_NAME="project-nomad"

###############################################################################
# Pre-flight Checks
###############################################################################

check_is_bash() {
  if [[ -z "$BASH_VERSION" ]]; then
    echo -e "${RED}#${RESET} Este script precisa ser executado com o bash."
    echo -e "${RED}#${RESET} Exemplo: bash $(basename "$0")"
    exit 1
  fi
  echo -e "${GREEN}#${RESET} Rodando no bash.\n"
}

check_has_sudo() {
  if sudo -n true 2>/dev/null; then
    echo -e "${GREEN}#${RESET} Permissão de sudo confirmada.\n"
  else
    echo -e "${RED}#${RESET} Este script precisa de permissão de sudo."
    echo -e "${RED}#${RESET} Exemplo: sudo bash $(basename "$0")"
    exit 1
  fi
}

check_confirmation() {
  echo -e "${YELLOW}#${RESET} Este script migra a sua instalação do monolith-nomad do coletor de"
  echo -e "${YELLOW}#${RESET} informações de disco no host para o novo sidecar disk-collector."
  echo -e "${YELLOW}#${RESET} Ele vai alterar o compose.yml e reiniciar toda a stack do compose"
  echo -e "${YELLOW}#${RESET} para remover o bind mount antigo em /tmp e iniciar o sidecar disk-collector."
  echo -e "${YELLOW}#${RESET} Garanta que você tem um backup dos seus dados antes de continuar.\n"

  echo -e "${RED}#${RESET} PARE: se você personalizou o compose.yml ou o armazenamento do monolith-nomad (incomum), faça essas mudanças manualmente em vez de usar este script!\n"
  read -rp "Deseja continuar? (s/N) " response
  if [[ ! "$response" =~ ^[YySs]$ ]]; then
    echo -e "${RED}#${RESET} Cancelado. Nada foi alterado."
    exit 0
  fi
  echo -e "${GREEN}#${RESET} Confirmação recebida. Iniciando a migração...\n"
}

check_docker_running() {
  if ! command -v docker &>/dev/null; then
    echo -e "${RED}#${RESET} O Docker não está instalado. Não é possível continuar."
    exit 1
  fi
  if ! systemctl is-active --quiet docker; then
    echo -e "${RED}#${RESET} O Docker não está rodando. Inicie o Docker e tente de novo."
    exit 1
  fi
  echo -e "${GREEN}#${RESET} O Docker está rodando.\n"
}

check_compose_file() {
  if [[ ! -f "$COMPOSE_FILE" ]]; then
    echo -e "${RED}#${RESET} compose.yml não encontrado em ${COMPOSE_FILE}."
    echo -e "${RED}#${RESET} O monolith-nomad não parece estar instalado, ou o compose.yml está faltando."
    exit 1
  fi
  echo -e "${GREEN}#${RESET} compose.yml encontrado em ${COMPOSE_FILE}.\n"
}

# Step 1: Stop old host process
stop_old_host_process() {
  local pid_file="${NOMAD_DIR}/nomad-collect-disk-info.pid"

  if [[ -f "$pid_file" ]]; then
    echo -e "${YELLOW}#${RESET} Parando o processo antigo collect-disk-info em segundo plano..."
    local pid
    pid=$(cat "$pid_file")
    if kill "$pid" 2>/dev/null; then
      echo -e "${GREEN}#${RESET} Processo ${pid} parado.\n"
    else
      echo -e "${YELLOW}#${RESET} O processo ${pid} não estava rodando (já parado).\n"
    fi
    rm -f "$pid_file"
  else
    echo -e "${GREEN}#${RESET} Nenhum arquivo PID antigo do collect-disk-info encontrado. Nada a parar.\n"
  fi
}

# Step 2: Backup compose.yml
backup_compose_file() {
  local backup="${COMPOSE_FILE}.bak.$(date +%Y%m%d%H%M%S)"
  echo -e "${YELLOW}#${RESET} Fazendo backup do compose.yml em ${backup}..."
  if cp "$COMPOSE_FILE" "$backup"; then
    echo -e "${GREEN}#${RESET} Backup criado em ${backup}.\n"
  else
    echo -e "${RED}#${RESET} Falha ao criar o backup. Cancelando."
    exit 1
  fi
}

# Step 3: Remove old bind-mount from admin volumes
remove_old_bind_mount() {
  if ! grep -q 'nomad-disk-info\.json' "$COMPOSE_FILE"; then
    echo -e "${GREEN}#${RESET} Bind mount antigo /tmp/nomad-disk-info.json não encontrado. Já foi removido.\n"
    return 0
  fi

  echo -e "${YELLOW}#${RESET} Removendo o bind mount antigo /tmp/nomad-disk-info.json dos volumes do admin..."
  sed -i '/\/tmp\/nomad-disk-info\.json:\/app\/storage\/nomad-disk-info\.json/d' "$COMPOSE_FILE"

  if grep -q 'nomad-disk-info\.json' "$COMPOSE_FILE"; then
    echo -e "${RED}#${RESET} Falha ao remover o bind mount antigo do compose.yml. Remova manualmente:"
    echo -e "${WHITE_R}      - /tmp/nomad-disk-info.json:/app/storage/nomad-disk-info.json${RESET}"
    exit 1
  fi

  echo -e "${GREEN}#${RESET} Bind mount antigo removido.\n"
}

# Step 4: Add disk-collector service block
add_disk_collector_service() {
  if grep -q 'disk-collector:' "$COMPOSE_FILE"; then
    echo -e "${GREEN}#${RESET} O serviço disk-collector já está no compose.yml. Pulando.\n"
    return 0
  fi

  echo -e "${YELLOW}#${RESET} Adicionando o serviço disk-collector ao compose.yml..."

  # Insert the disk-collector service block before the top-level `volumes:` key
  awk '/^volumes:/{
    print "  disk-collector:"
    print "    image: ghcr.io/jhonatanoliveira2/project-nomad-disk-collector:latest"
    print "    pull_policy: always"
    print "    container_name: nomad_disk_collector"
    print "    restart: unless-stopped"
    print "    volumes:"
    print "      - /:/host:ro,rslave  # Read-only view of host FS with rslave propagation so /sys and /proc submounts are visible"
    print "      - /opt/project-nomad/storage:/storage  # Shared storage dir — disk info written here is read by the admin container"
    print ""
  }
  {print}' "$COMPOSE_FILE" > "${COMPOSE_FILE}.tmp" && mv "${COMPOSE_FILE}.tmp" "$COMPOSE_FILE"

  if ! grep -q 'disk-collector:' "$COMPOSE_FILE"; then
    echo -e "${RED}#${RESET} Falha ao adicionar o serviço disk-collector. Adicione-o manualmente antes da chave volumes: de nível superior."
    exit 1
  fi

  echo -e "${GREEN}#${RESET} Serviço disk-collector adicionado.\n"
}

# Step 5 — Pull new image and restart the full stack
# This will re-create the admin container and drop the old /tmp bind, and
# also starts the new disk-collector sidecar we just added to compose.yml
restart_stack() {
  echo -e "${YELLOW}#${RESET} Baixando as imagens mais recentes (incluindo o disk-collector)..."
  if ! docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" pull; then
    echo -e "${RED}#${RESET} Falha ao baixar as imagens. Confira a conexão de rede."
    exit 1
  fi
  echo -e "${GREEN}#${RESET} Imagens baixadas.\n"

  echo -e "${YELLOW}#${RESET} Reiniciando a stack..."
  if ! docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" up -d; then
    echo -e "${RED}#${RESET} Falha ao subir a stack."
    exit 1
  fi
  echo -e "${GREEN}#${RESET} Stack reiniciada.\n"
}

# Step 6: Verify
verify_disk_collector_running() {
  sleep 3
  if docker ps --filter "name=^nomad_disk_collector$" --filter "status=running" --format '{{.Names}}' | grep -qx "nomad_disk_collector"; then
    echo -e "${GREEN}#${RESET} O container disk-collector está rodando.\n"
  else
    echo -e "${RED}#${RESET} O container disk-collector não parece estar rodando."
    echo -e "${RED}#${RESET} Veja os logs com: docker logs nomad_disk_collector"
    exit 1
  fi
}

# Main
echo -e "${GREEN}#########################################################################${RESET}"
echo -e "${GREEN}#${RESET}    monolith-nomad — Script de migração do coletor de disco        ${GREEN}#${RESET}"
echo -e "${GREEN}#########################################################################${RESET}\n"

check_is_bash
check_has_sudo
check_confirmation
check_docker_running
check_compose_file

echo -e "${YELLOW}#${RESET} Passo 1: parando o processo antigo do host...\n"
stop_old_host_process

echo -e "${YELLOW}#${RESET} Passo 2: fazendo backup do compose.yml...\n"
backup_compose_file

echo -e "${YELLOW}#${RESET} Passo 3: removendo o bind mount antigo...\n"
remove_old_bind_mount

echo -e "${YELLOW}#${RESET} Passo 4: adicionando o serviço disk-collector...\n"
add_disk_collector_service

echo -e "${YELLOW}#${RESET} Passo 5: baixando as imagens e reiniciando a stack...\n"
restart_stack

echo -e "${YELLOW}#${RESET} Passo 6: verificando se o disk-collector está rodando...\n"
verify_disk_collector_running

echo -e "${GREEN}#########################################################################${RESET}"
echo -e "${GREEN}#${RESET} Migração concluída com sucesso!"
echo -e "${GREEN}#${RESET}"
echo -e "${GREEN}#${RESET} O sidecar disk-collector está rodando e vai atualizar as informações de disco"
echo -e "${GREEN}#${RESET} a cada 2 minutos. O endpoint /api/system/info passa a retornar os dados de disco"
echo -e "${GREEN}#${RESET} depois da primeira gravação do coletor (cerca de 5 segundos após a inicialização)."
echo -e "${GREEN}#${RESET}"
echo -e "${GREEN}#########################################################################${RESET}\n"
