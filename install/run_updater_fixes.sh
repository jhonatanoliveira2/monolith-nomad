#!/bin/bash

# Project NOMAD - One-Time Updater Fix Script
#
# Script                | Project NOMAD One-Time Updater Fix Script
# Version               | 1.0.0
# Author                | Crosstalk Solutions, LLC
# Website               | https://crosstalksolutions.com
#
# PURPOSE:
#   This is a one-time migration script. It deploys two fixes to the sidecar
#   updater that cannot be applied through the normal in-app update mechanism:
#
#   Fix 1 — Sidecar volume write access
#     Removes the :ro (read-only) flag from the sidecar's /opt/project-nomad
#     volume mount in compose.yml. The sidecar must be able to write to
#     compose.yml so it can set the correct Docker image tag when installing
#     RC or stable versions.
#
#   Fix 2 — RC-aware sidecar watcher
#     Downloads the updated sidecar Dockerfile (adds jq) and update-watcher.sh
#     (reads target_tag from the update request and applies it to compose.yml
#     before pulling images), then rebuilds and restarts the sidecar container.
#
#   NOTE: The companion fix in the admin service (system_update_service.ts,
#   which writes the target_tag into the update request) ships in the GHCR
#   image and will take effect automatically on the next normal app update.

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
SIDECAR_DIR="${NOMAD_DIR}/sidecar-updater"
COMPOSE_PROJECT_NAME="project-nomad"

NOMAD_GITHUB_REPO="${NOMAD_GITHUB_REPO:-jhonatanoliveira2/monolith-nomad}"
# set by resolve_nomad_source (latest published release by default)
NOMAD_RAW_BASE_URL=''
SIDECAR_DOCKERFILE_URL=''
SIDECAR_SCRIPT_URL=''

# Where the files this script downloads come from. By default the latest PUBLISHED RELEASE of this distribution,
# so the compose file and helper scripts match the images that release built (a moving branch can be ahead
# of them). Overrides:
#   NOMAD_RELEASE_TAG=v1.36.0   a specific release
#   NOMAD_GITHUB_BRANCH=main    a development branch instead (explicit opt-in, not for production)
#   NOMAD_GITHUB_REPO=dono/repo another fork
resolve_nomad_source() {
  local ref tag
  if ! [[ "${NOMAD_GITHUB_REPO}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ && "${NOMAD_GITHUB_REPO}" != *..* ]]; then
    echo -e "${RED}#${RESET} NOMAD_GITHUB_REPO inválido: '${NOMAD_GITHUB_REPO}' (esperado: dono/repositório)." >&2
    return 1
  fi
  if [[ -n "${NOMAD_GITHUB_BRANCH:-}" ]]; then
    # git ref rules that matter here: no leading "-" or "/", no trailing "/", no "//" and no ".."
    if ! [[ "${NOMAD_GITHUB_BRANCH}" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*$ && "${NOMAD_GITHUB_BRANCH}" != *..* &&
      "${NOMAD_GITHUB_BRANCH}" != *//* && "${NOMAD_GITHUB_BRANCH}" != */ ]]; then
      echo -e "${RED}#${RESET} NOMAD_GITHUB_BRANCH inválido: '${NOMAD_GITHUB_BRANCH}'." >&2
      return 1
    fi
    echo -e "${YELLOW}#${RESET} Usando o branch de desenvolvimento '${NOMAD_GITHUB_BRANCH}', e não uma release publicada." >&2
    ref="refs/heads/${NOMAD_GITHUB_BRANCH}"
  else
    tag="${NOMAD_RELEASE_TAG:-}"
    if [[ -z "$tag" ]]; then
      tag="$(curl -fsSL --max-time 20 --retry 3 --retry-delay 2 -H 'Accept: application/vnd.github+json' \
        "https://api.github.com/repos/${NOMAD_GITHUB_REPO}/releases/latest" 2>/dev/null |
        sed -n 's/^[[:space:]]*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
      if [[ -z "$tag" ]]; then
        echo -e "${RED}#${RESET} Nenhuma release publicada encontrada em ${NOMAD_GITHUB_REPO} (ou a API do GitHub não respondeu: sem rede, ou o limite de requisições sem autenticação, 60 por hora por IP, foi atingido)." >&2
        echo -e "${RED}#${RESET} Fixe uma release com NOMAD_RELEASE_TAG=vX.Y.Z (não consulta a API) ou, em desenvolvimento, use NOMAD_GITHUB_BRANCH=main." >&2
        return 1
      fi
    fi
    if ! [[ "$tag" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
      echo -e "${RED}#${RESET} Tag de release inválida: '${tag}'." >&2
      return 1
    fi
    ref="refs/tags/${tag}"
  fi
  NOMAD_RAW_BASE_URL="https://raw.githubusercontent.com/${NOMAD_GITHUB_REPO}/${ref}"
  SIDECAR_DOCKERFILE_URL="${NOMAD_RAW_BASE_URL}/install/sidecar-updater/Dockerfile"
  SIDECAR_SCRIPT_URL="${NOMAD_RAW_BASE_URL}/install/sidecar-updater/update-watcher.sh"
}

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

check_confirmation() {
  echo -e "${YELLOW}#${RESET} Este é um script de correção muito específico, para um problema muito específico. Provavelmente você não precisa rodá-lo, a menos que o mantenedor do monolith-nomad tenha orientado você a fazer isso."
  echo -e "${YELLOW}#${RESET} Garanta que você tem um backup dos seus dados antes de continuar."
  read -rp "Deseja continuar? (s/N) " response
  if [[ ! "$response" =~ ^[YySs]$ ]]; then
    echo -e "${RED}#${RESET} Cancelado. Nada foi alterado."
    exit 0
  fi
  echo -e "${GREEN}#${RESET} Confirmação recebida. Aplicando as correções...\n"
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
    echo -e "${RED}#${RESET} Verifique se o monolith-nomad está instalado antes de rodar este script."
    exit 1
  fi
  echo -e "${GREEN}#${RESET} compose.yml encontrado em ${COMPOSE_FILE}.\n"
}

check_sidecar_dir() {
  if [[ ! -d "$SIDECAR_DIR" ]]; then
    echo -e "${RED}#${RESET} Diretório do sidecar não encontrado em ${SIDECAR_DIR}."
    echo -e "${RED}#${RESET} Verifique se o monolith-nomad está instalado antes de rodar este script."
    exit 1
  fi
  echo -e "${GREEN}#${RESET} Diretório do sidecar encontrado em ${SIDECAR_DIR}.\n"
}

###############################################################################
# Fix 1 — Remove :ro from sidecar volume mount
###############################################################################

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

fix_sidecar_volume_mount() {
  # Idempotent: skip if :ro is already absent from the sidecar mount line
  if ! grep -q '/opt/project-nomad:/opt/project-nomad:ro' "$COMPOSE_FILE"; then
    echo -e "${GREEN}#${RESET} A montagem do volume do sidecar já permite escrita. Nada a alterar.\n"
    return 0
  fi

  echo -e "${YELLOW}#${RESET} Removendo a restrição :ro da montagem do volume do sidecar no compose.yml..."
  sed -i 's|/opt/project-nomad:/opt/project-nomad:ro.*|/opt/project-nomad:/opt/project-nomad # Writable access required so the updater can set the correct image tag in compose.yml|' "$COMPOSE_FILE"

  if grep -q '/opt/project-nomad:/opt/project-nomad:ro' "$COMPOSE_FILE"; then
    echo -e "${RED}#${RESET} Falha ao remover o :ro do compose.yml. Atualize manualmente:"
    echo -e "${WHITE_R}    - /opt/project-nomad:/opt/project-nomad:ro${RESET}  →  ${WHITE_R}- /opt/project-nomad:/opt/project-nomad${RESET}"
    exit 1
  fi

  echo -e "${GREEN}#${RESET} Montagem do volume do sidecar atualizada com sucesso.\n"
}

###############################################################################
# Fix 2 — Download updated sidecar files and rebuild
###############################################################################

download_updated_sidecar_files() {
  echo -e "${YELLOW}#${RESET} Baixando o Dockerfile atualizado do sidecar..."
  if ! curl -fsSL "$SIDECAR_DOCKERFILE_URL" -o "${SIDECAR_DIR}/Dockerfile"; then
    echo -e "${RED}#${RESET} Falha ao baixar o Dockerfile do sidecar. Confira a conexão de rede."
    exit 1
  fi
  echo -e "${GREEN}#${RESET} Dockerfile do sidecar atualizado.\n"

  echo -e "${YELLOW}#${RESET} Baixando o update-watcher.sh atualizado..."
  if ! curl -fsSL "$SIDECAR_SCRIPT_URL" -o "${SIDECAR_DIR}/update-watcher.sh"; then
    echo -e "${RED}#${RESET} Falha ao baixar o update-watcher.sh. Confira a conexão de rede."
    exit 1
  fi
  chmod +x "${SIDECAR_DIR}/update-watcher.sh"
  echo -e "${GREEN}#${RESET} update-watcher.sh atualizado.\n"
}

rebuild_sidecar() {
  echo -e "${YELLOW}#${RESET} Reconstruindo o container do atualizador (pode levar um momento)..."
  if ! docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" build updater; then
    echo -e "${RED}#${RESET} Falha ao reconstruir o container do atualizador. Veja os detalhes na saída acima."
    exit 1
  fi
  echo -e "${GREEN}#${RESET} Container do atualizador reconstruído com sucesso.\n"
}

restart_sidecar() {
  echo -e "${YELLOW}#${RESET} Parando e removendo os containers do atualizador existentes..."

  # Stop and remove via compose first (handles the compose-tracked container)
  docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" stop updater >> /dev/null 2>&1 || true
  docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" rm -f updater >> /dev/null 2>&1 || true

  # Force-remove any stale container still holding the name (e.g. hash-prefixed remnants)
  docker rm -f nomad_updater >> /dev/null 2>&1 || true

  echo -e "${YELLOW}#${RESET} Iniciando o container do atualizador atualizado..."
  if ! docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" up -d updater; then
    echo -e "${RED}#${RESET} Falha ao iniciar o container do atualizador."
    exit 1
  fi
  echo -e "${GREEN}#${RESET} Container do atualizador iniciado.\n"
}

verify_sidecar_running() {
  sleep 3
  # Use exact name match to avoid false positives from hash-prefixed stale containers
  if docker ps --filter "name=^nomad_updater$" --filter "status=running" --format '{{.Names}}' | grep -qx "nomad_updater"; then
    echo -e "${GREEN}#${RESET} O container do atualizador está rodando.\n"
  else
    echo -e "${RED}#${RESET} O container do atualizador não parece estar rodando."
    echo -e "${RED}#${RESET} Veja os logs com: docker logs nomad_updater"
    exit 1
  fi
}

###############################################################################
# Main
###############################################################################

echo -e "${GREEN}#########################################################################${RESET}"
echo -e "${GREEN}#${RESET}   monolith-nomad — Script de correção única do atualizador        ${GREEN}#${RESET}"
echo -e "${GREEN}#########################################################################${RESET}\n"

check_is_bash
check_has_sudo
check_confirmation
check_docker_running
check_compose_file
check_sidecar_dir
# before any change: the files of fix 2 must come from a published release
resolve_nomad_source || exit 1

echo -e "${YELLOW}#${RESET} Iniciando a correção 1: acesso de escrita ao volume do sidecar...\n"
backup_compose_file
fix_sidecar_volume_mount

echo -e "${YELLOW}#${RESET} Iniciando a correção 2: watcher do sidecar com suporte a RC...\n"
download_updated_sidecar_files
rebuild_sidecar
restart_sidecar
verify_sidecar_running

echo -e "${GREEN}#########################################################################${RESET}"
echo -e "${GREEN}#${RESET} Todas as correções foram aplicadas com sucesso!"
echo -e "${GREEN}#${RESET}"
echo -e "${GREEN}#${RESET} Agora o sidecar do atualizador instala corretamente as versões RC e estáveis."
echo -e "${GREEN}#${RESET} A correção restante (suporte a target_tag no serviço admin) será aplicada"
echo -e "${GREEN}#${RESET} automaticamente na próxima vez que você atualizar o monolith-nomad pela interface."
echo -e "${GREEN}#########################################################################${RESET}\n"
