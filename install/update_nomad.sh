#!/bin/bash

# Project NOMAD Update Script

###################################################################################################################################################################################################

# Script                | Project NOMAD Update Script
# Version               | 1.0.1
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
#                                                                                           Functions                                                                                             #
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

check_is_bash() {
  if [[ -z "$BASH_VERSION" ]]; then
    header_red
    echo -e "${RED}#${RESET} Este script precisa do bash. Execute-o com o bash.\\n"
    echo -e "${RED}#${RESET} Por exemplo: bash $(basename "$0")"
    exit 1
  fi
    echo -e "${GREEN}#${RESET} O script está rodando no bash.\\n"
}

check_is_debian_based() {
  if [[ ! -f /etc/debian_version ]]; then
    header_red
    echo -e "${RED}#${RESET} Este script foi feito só para sistemas baseados em Debian.\\n"
    echo -e "${RED}#${RESET} Execute-o num sistema baseado em Debian (como o Ubuntu) e tente de novo."
    exit 1
  fi
    echo -e "${GREEN}#${RESET} O sistema é baseado em Debian.\\n"
}

get_update_confirmation(){
  read -p "Este script vai atualizar o monolith-nomad e as dependências dele nesta máquina. Não se espera perda de dados, mas sempre faça backup antes de continuar. Tem certeza de que deseja continuar? (s/n): " choice
  case "$choice" in
    y|Y|s|S )
      echo -e "${GREEN}#${RESET} Você escolheu continuar a atualização."
      ;;
    n|N )
      echo -e "${RED}#${RESET} Você escolheu não continuar a atualização."
      exit 0
      ;;
    * )
      echo "Resposta inválida"
      echo "Você escolheu não continuar a atualização."
      exit 0
      ;;
  esac
}

ensure_docker_installed_and_running() {
  if ! command -v docker &> /dev/null; then
    echo -e "${RED}#${RESET} O Docker não está instalado. Isso é inesperado, porque o monolith-nomad precisa do Docker. Você queria usar o script de instalação em vez do de atualização?"
    exit 1
  fi

  if ! systemctl is-active --quiet docker; then
    echo -e "${RED}#${RESET} O Docker não está rodando. Tentando iniciá-lo..."
    sudo systemctl start docker
    if ! systemctl is-active --quiet docker; then
      echo -e "${RED}#${RESET} Falha ao iniciar o Docker. Inicie o Docker e tente de novo."
      exit 1
    fi
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

ensure_docker_compose_file_exists() {
  if [ ! -f "/opt/project-nomad/compose.yml" ]; then
    echo -e "${RED}#${RESET} Arquivo compose.yml não encontrado. Verifique se ele existe em /opt/project-nomad/compose.yml."
    exit 1
  fi
}

force_recreate() {
  echo -e "${YELLOW}#${RESET} Baixando as imagens Docker mais recentes..."
  if ! docker compose -p project-nomad -f /opt/project-nomad/compose.yml pull; then
    echo -e "${RED}#${RESET} Falha ao baixar as imagens Docker mais recentes. Confira a conexão de rede e o status do registro de imagens e tente de novo."
    exit 1
  fi
  
  echo -e "${YELLOW}#${RESET} Forçando a recriação dos containers..."
  if ! docker compose -p project-nomad -f /opt/project-nomad/compose.yml up -d --force-recreate; then
    echo -e "${RED}#${RESET} Falha ao recriar os containers. Confira os logs do Docker para mais detalhes."
    exit 1
  fi
}

get_local_ip() {
  local_ip_address=$(hostname -I | awk '{print $1}')
  if [[ -z "$local_ip_address" ]]; then
    echo -e "${RED}#${RESET} Não foi possível descobrir o endereço IP local. Confira a configuração de rede."
    # Don't exit if we can't determine the local IP address, it's not critical for the installation
  fi
}

success_message() {
  echo -e "${GREEN}#${RESET} Atualização do monolith-nomad concluída com sucesso!\\n"
  echo -e "${GREEN}#${RESET} Os arquivos da instalação ficam em /opt/project-nomad\\n\n"
  echo -e "${GREEN}#${RESET} A Central de Comando do monolith-nomad deve iniciar sozinha sempre que o computador reiniciar. Se precisar iniciá-la manualmente, execute: ${WHITE_R}${nomad_dir}/start_nomad.sh${RESET}\\n"
  echo -e "${GREEN}#${RESET} Acesse a interface de gerenciamento em http://localhost:8080 ou http://${local_ip_address}:8080\\n"
  echo -e "${GREEN}#${RESET} Obrigado por usar o monolith-nomad!\\n"
}

###################################################################################################################################################################################################
#                                                                                                                                                                                                 #
#                                                                                           Main Script                                                                                           #
#                                                                                                                                                                                                 #
###################################################################################################################################################################################################

# Pre-flight checks
check_is_debian_based
check_is_bash
check_has_sudo

# Main update
get_update_confirmation
ensure_docker_installed_and_running
check_docker_compose
ensure_docker_compose_file_exists
force_recreate
get_local_ip
success_message
