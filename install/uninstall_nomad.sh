#!/bin/bash

# Project NOMAD Uninstall Script

###################################################################################################################################################################################################

# Script                | Project NOMAD Uninstall Script
# Version               | 1.0.0
# Author                | Crosstalk Solutions, LLC
# Website               | https://crosstalksolutions.com

###################################################################################################################################################################################################
#                                                                                                                                                                                                 #
#                                                                                           Color Codes                                                                                           #
#                                                                                                                                                                                                 #
###################################################################################################################################################################################################

RESET='\033[0m'
YELLOW='\033[1;33m'
WHITE_R='\033[39m' # Same as GRAY_R for terminals with white background.
GRAY_R='\033[39m'
RED='\033[1;31m' # Light Red.
GREEN='\033[1;32m' # Light Green.

###################################################################################################################################################################################################
#                                                                                                                                                                                                 #
#                                                                                  Constants & Variables                                                                                          #
#                                                                                                                                                                                                 #
###################################################################################################################################################################################################

NOMAD_DIR="/opt/project-nomad"
MANAGEMENT_COMPOSE_FILE="${NOMAD_DIR}/compose.yml"

###################################################################################################################################################################################################
#                                                                                                                                                                                                 #
#                                                                                     Functions                                                                                                   #
#                                                                                                                                                                                                 #
###################################################################################################################################################################################################

header_red() {
  if [[ "${script_option_debug}" != 'true' ]]; then clear; clear; fi
  echo -e "${RED}#########################################################################${RESET}\\n"
}

check_has_sudo() {
  if sudo -n true 2>/dev/null; then
    echo -e "${GREEN}#${RESET} O usuário tem permissão de sudo.\\n"
  else
    echo "O usuário não tem permissão de sudo"
    header_red
    echo -e "${RED}#${RESET} Este script precisa de permissão de sudo. Execute-o com sudo.\\n"
    echo -e "${RED}#${RESET} Por exemplo: sudo bash $(basename "$0")"
    exit 1
  fi
}

check_current_directory(){
  if [ "$(pwd)" == "${NOMAD_DIR}" ]; then
    echo "Execute este script a partir de um diretório diferente de ${NOMAD_DIR}."
    exit 1
  fi
}

ensure_management_compose_file_exists(){
  if [ ! -f "${MANAGEMENT_COMPOSE_FILE}" ]; then
    echo "Não foi possível encontrar o arquivo Docker Compose de gerenciamento em ${MANAGEMENT_COMPOSE_FILE}. Pode haver um problema na sua instalação do monolith-nomad."
    exit 1
  fi
}

get_uninstall_confirmation(){
  read -p "Este script vai remover TODOS os arquivos e containers do monolith-nomad. ISSO NÃO PODE SER DESFEITO. Tem certeza de que deseja continuar? (s/n): " choice
  case "$choice" in
    y|Y|s|S )
      echo -e "Você escolheu continuar a desinstalação."
      ;;
    n|N )
      echo -e "Você escolheu não continuar a desinstalação."
      exit 0
      ;;
    * )
      echo "Resposta inválida"
      echo "Você escolheu não continuar a desinstalação."
      exit 0
      ;;
  esac
}

ensure_docker_installed() {
    if ! command -v docker &> /dev/null; then
        echo "Não foi possível encontrar o Docker. Pode haver um problema na sua instalação do Docker."
        exit 1
    fi
}

check_docker_compose() {
  # Check if 'docker compose' (v2 plugin) is available
  if ! docker compose version &>/dev/null; then
    echo -e "${RED}#${RESET} O Docker Compose v2 não está instalado ou não está disponível como plugin do Docker."
    echo -e "${YELLOW}#${RESET} Este script precisa do 'docker compose' (v2), não do 'docker-compose' (v1)."
    echo -e "${YELLOW}#${RESET} Veja como instalar o Docker Compose v2 na documentação do Docker: https://docs.docker.com/compose/install/"
    exit 1
  fi
}

storage_cleanup() {
  read -p "Deseja excluir o diretório de armazenamento do monolith-nomad (${NOMAD_DIR})? É o ideal se você quer recomeçar com uma instalação totalmente limpa. Isso vai EXCLUIR PERMANENTEMENTE todos os dados guardados e não pode ser desfeito! (s/N): " delete_dir_choice
  case "$delete_dir_choice" in
      y|Y|s|S )
          echo "Removendo os arquivos do monolith-nomad..."
          if rm -rf "${NOMAD_DIR}"; then
              echo "Arquivos do monolith-nomad removidos."
          else
              echo "Aviso: falha ao remover ${NOMAD_DIR} por completo. Talvez seja preciso removê-lo manualmente."
          fi
          ;;
      * )
          echo "Mantendo ${NOMAD_DIR} (não removido)."
          ;;
  esac
}

uninstall_nomad() {
    echo "Parando e removendo os containers de gerenciamento do monolith-nomad..."
    docker compose -p project-nomad -f "${MANAGEMENT_COMPOSE_FILE}" down
    echo "Aguardando os containers de gerenciamento pararem..."
    sleep 5


    # Stop and remove all containers where name starts with "nomad_"
    echo "Parando e removendo todos os containers de apps do monolith-nomad..."
    docker ps -a --filter "name=^nomad_" --format "{{.Names}}" | xargs -r docker rm -f
    echo "Aguardando os containers de apps pararem..."
    sleep 5

    echo "Os containers já devem estar parados."

    # Remove the shared Docker network (may still exist if app containers were using it during compose down)
    echo "Removendo a rede project-nomad_default, se existir..."
    docker network rm project-nomad_default 2>/dev/null && echo "Rede removida." || echo "Rede já removida ou não encontrada."

    # Remove the shared update volume
    echo "Removendo o volume project-nomad_nomad-update-shared, se existir..."
    docker volume rm project-nomad_nomad-update-shared 2>/dev/null && echo "Volume removido." || echo "Volume já removido ou não encontrado."

    # Prompt user for storage cleanup and handle it if so
    storage_cleanup

    echo "O monolith-nomad foi desinstalado. Até a próxima!"
}

###################################################################################################################################################################################################
#                                                                                                                                                                                                 #
#                                                                                       Main                                                                                                      #
#                                                                                                                                                                                                 #
###################################################################################################################################################################################################
check_has_sudo
check_current_directory
ensure_management_compose_file_exists
ensure_docker_installed
check_docker_compose
get_uninstall_confirmation
uninstall_nomad