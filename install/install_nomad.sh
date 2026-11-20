#!/bin/bash

# Project NOMAD Installation Script

###################################################################################################################################################################################################

# Script                | Project NOMAD Installation Script
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

WHIPTAIL_TITLE="Instalação do monolith-nomad"
NOMAD_DIR="/opt/project-nomad"
# Where this distribution (monolith-nomad) is published. The download URLs are set by resolve_nomad_source
# (latest published release by default; see the function), e.g. to install a pinned release or another fork:
#   NOMAD_RELEASE_TAG=v1.36.0 NOMAD_GITHUB_REPO=owner/repo sudo -E bash install_nomad.sh
NOMAD_GITHUB_REPO="${NOMAD_GITHUB_REPO:-jhonatanoliveira2/monolith-nomad}"
NOMAD_RAW_BASE_URL=''
MANAGEMENT_COMPOSE_FILE_URL=''
START_SCRIPT_URL=''
STOP_SCRIPT_URL=''
UPDATE_SCRIPT_URL=''
script_option_debug='true'
accepted_terms='false'
local_ip_address=''
preflight_compose_file=''

###################################################################################################################################################################################################
#                                                                                                                                                                                                 #
#                                                                                           Functions                                                                                             #
#                                                                                                                                                                                                 #
###################################################################################################################################################################################################

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
  MANAGEMENT_COMPOSE_FILE_URL="${NOMAD_RAW_BASE_URL}/install/management_compose.yaml"
  START_SCRIPT_URL="${NOMAD_RAW_BASE_URL}/install/start_nomad.sh"
  STOP_SCRIPT_URL="${NOMAD_RAW_BASE_URL}/install/stop_nomad.sh"
  UPDATE_SCRIPT_URL="${NOMAD_RAW_BASE_URL}/install/update_nomad.sh"
}

header() {
  if [[ "${script_option_debug}" != 'true' ]]; then clear; clear; fi
  echo -e "${GREEN}#########################################################################${RESET}\\n"
}

header_red() {
  if [[ "${script_option_debug}" != 'true' ]]; then clear; clear; fi
  echo -e "${RED}#########################################################################${RESET}\\n"
}

banner() {
  echo ""
  echo -e "${GREEN}"
  cat <<'NOMAD_ART'
                           M O N O L I T H
                    _   _  ___  __  __    _    ____
                   | \ | |/ _ \|  \/  |  / \  |  _ \
                   |  \| | | | | |\/| | / _ \ | | | |
                   | |\  | |_| | |  | |/ ___ \| |_| |
                   |_| \_|\___/|_|  |_/_/   \_\____/
NOMAD_ART
  echo -e "${RESET}"
  echo -e "${WHITE_R}              Servidor offline de conhecimento e educação${RESET}\n"
  echo -e "${GREEN}#########################################################################${RESET}\n"
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

check_is_x86_64() {
  local arch
  arch="$(uname -m)"
  if [[ "${arch}" != "x86_64" && "${arch}" != "amd64" ]]; then
    echo -e "${YELLOW}#${RESET} AVISO: arquitetura detectada: '${arch}'. O monolith-nomad só tem suporte oficial a x86_64.\\n"
    echo -e "${YELLOW}#${RESET} O suporte a ARM64/aarch64 ainda não está pronto (acompanhado no PR #419 do projeto original).\\n"
    echo -e "${YELLOW}#${RESET} Continuar numa arquitetura sem suporte provavelmente vai falhar e pode deixar para trás\\n"
    echo -e "${YELLOW}#${RESET} imagens Docker e arquivos parciais que você terá de remover manualmente.\\n"
    echo -e "${YELLOW}#${RESET} Continuando em 10 segundos... pressione Ctrl+C agora para cancelar.\\n"
    sleep 10
    return
  fi
  echo -e "${GREEN}#${RESET} Arquitetura verificada (${arch}).\\n"
}

ensure_dependencies_installed() {
  local missing_deps=()

  # Check for curl
  if ! command -v curl &> /dev/null; then
    missing_deps+=("curl")
  fi

  # Check for gpg (required for NVIDIA container toolkit keyring)
  if ! command -v gpg &> /dev/null; then
    missing_deps+=("gpg")
  fi

  # Check for whiptail (used for dialogs, though not currently active)
  # if ! command -v whiptail &> /dev/null; then
  #   missing_deps+=("whiptail")
  # fi

  if [[ ${#missing_deps[@]} -gt 0 ]]; then
    echo -e "${YELLOW}#${RESET} Instalando as dependências necessárias: ${missing_deps[*]}...\\n"
    sudo apt-get update
    sudo apt-get install -y "${missing_deps[@]}"

    # Verify installation
    for dep in "${missing_deps[@]}"; do
      if ! command -v "$dep" &> /dev/null; then
        echo -e "${RED}#${RESET} Falha ao instalar $dep. Instale manualmente e tente de novo."
        exit 1
      fi
    done
    echo -e "${GREEN}#${RESET} Dependências instaladas com sucesso.\\n"
  else
    echo -e "${GREEN}#${RESET} Todas as dependências necessárias já estão instaladas.\\n"
  fi
}

check_is_debug_mode(){
  # Check if the script is being run in debug mode
  if [[ "${script_option_debug}" == 'true' ]]; then
    echo -e "${YELLOW}#${RESET} Modo de depuração ativo: o script não vai limpar a tela...\\n"
  else
    clear; clear
  fi
}

generateRandomPass() {
  local length="${1:-32}"  # Default to 32
  local password
  
  # Generate random password using /dev/urandom
  password=$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c "$length")
  
  echo "$password"
}

ensure_docker_installed() {
  if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}#${RESET} Docker não encontrado. Instalando o Docker...\\n"
    
    # Update package database
    sudo apt-get update
    
    # Install prerequisites
    sudo apt-get install -y ca-certificates curl
    
    # Create directory for keyrings
    # sudo install -m 0755 -d /etc/apt/keyrings
    
    # # Download Docker's official GPG key
    # sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
    # sudo chmod a+r /etc/apt/keyrings/docker.asc

    # # Add the repository to Apt sources
    # echo \
    #   "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
    #   $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    #   sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    # # Update the package database with the Docker packages from the newly added repo
    # sudo apt-get update

    # # Install Docker packages
    # sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Download the Docker convenience script
    curl -fsSL https://get.docker.com -o get-docker.sh

    # Run the Docker installation script
    sudo sh get-docker.sh

    # Check if Docker was installed successfully
    if ! command -v docker &> /dev/null; then
      echo -e "${RED}#${RESET} A instalação do Docker falhou. Confira os logs e tente de novo."
      exit 1
    fi
    
    echo -e "${GREEN}#${RESET} Instalação do Docker concluída.\\n"
  else
    echo -e "${GREEN}#${RESET} O Docker já está instalado.\\n"
    
    # Check if Docker service is running
    if ! systemctl is-active --quiet docker; then
      echo -e "${YELLOW}#${RESET} O Docker está instalado, mas não está rodando. Tentando iniciá-lo...\\n"
      sudo systemctl start docker
      if ! systemctl is-active --quiet docker; then
        echo -e "${RED}#${RESET} Falha ao iniciar o Docker. Confira o status do serviço do Docker e tente de novo."
        exit 1
      else
        echo -e "${GREEN}#${RESET} Serviço do Docker iniciado com sucesso.\\n"
      fi
    else
      echo -e "${GREEN}#${RESET} O serviço do Docker já está rodando.\\n"
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

setup_nvidia_container_toolkit() {
  # This function attempts to set up NVIDIA GPU support but is non-blocking
  # Any failures will result in warnings but will NOT stop the installation process
  
  echo -e "${YELLOW}#${RESET} Procurando GPU NVIDIA...\\n"
  
  # Safely detect NVIDIA GPU
  local has_nvidia_gpu=false
  if command -v lspci &> /dev/null; then
    if lspci 2>/dev/null | grep -i nvidia &> /dev/null; then
      has_nvidia_gpu=true
      echo -e "${GREEN}#${RESET} GPU NVIDIA detectada.\\n"
    fi
  fi
  
  # Also check for nvidia-smi
  if ! $has_nvidia_gpu && command -v nvidia-smi &> /dev/null; then
    if nvidia-smi &> /dev/null; then
      has_nvidia_gpu=true
      echo -e "${GREEN}#${RESET} GPU NVIDIA detectada pelo nvidia-smi.\\n"
    fi
  fi
  
  if ! $has_nvidia_gpu; then
    echo -e "${YELLOW}#${RESET} Nenhuma GPU NVIDIA detectada. Pulando a instalação do NVIDIA Container Toolkit.\\n"
    return 0
  fi
  
  # Check if nvidia-container-toolkit is already installed
  if command -v nvidia-ctk &> /dev/null; then
    echo -e "${GREEN}#${RESET} O NVIDIA Container Toolkit já está instalado.\\n"
    return 0
  fi
  
  echo -e "${YELLOW}#${RESET} Instalando o NVIDIA Container Toolkit...\\n"
  
  # Install dependencies per https://docs.ollama.com/docker - wrapped in error handling
  if ! curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey 2>/dev/null | sudo gpg --batch --yes --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg 2>/dev/null; then
    echo -e "${YELLOW}#${RESET} Aviso: falha ao adicionar a chave GPG do NVIDIA Container Toolkit. Continuando mesmo assim...\\n"
    return 0
  fi
  
  if ! curl -fsSL https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list 2>/dev/null \
      | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' \
      | sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list > /dev/null 2>&1; then
    echo -e "${YELLOW}#${RESET} Aviso: falha ao adicionar o repositório do NVIDIA Container Toolkit. Continuando mesmo assim...\\n"
    return 0
  fi
  
  if ! sudo apt-get update 2>/dev/null; then
    echo -e "${YELLOW}#${RESET} Aviso: falha ao atualizar a lista de pacotes. Continuando mesmo assim...\\n"
    return 0
  fi
  
  if ! sudo apt-get install -y nvidia-container-toolkit 2>/dev/null; then
    echo -e "${YELLOW}#${RESET} Aviso: falha ao instalar o NVIDIA Container Toolkit. Continuando mesmo assim...\\n"
    return 0
  fi
  
  echo -e "${GREEN}#${RESET} NVIDIA Container Toolkit instalado com sucesso.\\n"
  
  # Configure Docker to use NVIDIA runtime
  echo -e "${YELLOW}#${RESET} Configurando o Docker para usar o runtime da NVIDIA...\\n"
  
  if ! sudo nvidia-ctk runtime configure --runtime=docker 2>/dev/null; then
    echo -e "${YELLOW}#${RESET} O nvidia-ctk configure falhou. Tentando a configuração manual...\\n"
    
    # Fallback: Manually configure daemon.json
    local daemon_json="/etc/docker/daemon.json"
    local config_success=false
    
    if [[ -f "$daemon_json" ]]; then
      # Backup existing config (best effort)
      sudo cp "$daemon_json" "${daemon_json}.backup" 2>/dev/null || true
      
      # Check if nvidia runtime already exists
      if ! grep -q '"nvidia"' "$daemon_json" 2>/dev/null; then
        # Add nvidia runtime to existing config using jq if available
        if command -v jq &> /dev/null; then
          if sudo jq '. + {"runtimes": {"nvidia": {"path": "nvidia-container-runtime", "runtimeArgs": []}}}' "$daemon_json" > /tmp/daemon.json.tmp 2>/dev/null; then
            if sudo mv /tmp/daemon.json.tmp "$daemon_json" 2>/dev/null; then
              config_success=true
            fi
          fi
          # Clean up temp file if move failed
          sudo rm -f /tmp/daemon.json.tmp 2>/dev/null || true
        else
          echo -e "${YELLOW}#${RESET} jq indisponível. Pulando a configuração manual do daemon.json...\\n"
        fi
      else
        config_success=true  # Already configured
      fi
    else
      # Create new daemon.json with nvidia runtime (best effort)
      if echo '{"runtimes":{"nvidia":{"path":"nvidia-container-runtime","runtimeArgs":[]}}}' | sudo tee "$daemon_json" > /dev/null 2>&1; then
        config_success=true
      fi
    fi
    
    if ! $config_success; then
      echo -e "${YELLOW}#${RESET} A configuração manual do daemon.json não funcionou. O suporte à GPU pode exigir configuração manual.\\n"
    fi
  fi
  
  # Restart Docker service
  echo -e "${YELLOW}#${RESET} Reiniciando o serviço do Docker...\\n"
  if ! sudo systemctl restart docker 2>/dev/null; then
    echo -e "${YELLOW}#${RESET} Aviso: falha ao reiniciar o serviço do Docker. Talvez seja preciso reiniciá-lo manualmente.\\n"
    return 0
  fi
  
  # Verify NVIDIA runtime is available
  echo -e "${YELLOW}#${RESET} Verificando a configuração do runtime da NVIDIA...\\n"
  sleep 2  # Give Docker a moment to fully restart
  
  if docker info 2>/dev/null | grep -q "nvidia"; then
    echo -e "${GREEN}#${RESET} Runtime da NVIDIA configurado e verificado com sucesso.\\n"
  else
    echo -e "${YELLOW}#${RESET} Aviso: o runtime da NVIDIA não aparece no docker info. A aceleração por GPU pode não funcionar.\\n"
    echo -e "${YELLOW}#${RESET} Talvez seja preciso configurar o /etc/docker/daemon.json manualmente e reiniciar o Docker.\\n"
  fi
  
  echo -e "${GREEN}#${RESET} Configuração do NVIDIA Container Toolkit concluída.\\n"
}

get_install_confirmation(){
  echo -e "${YELLOW}#${RESET} Este script vai instalar o monolith-nomad e as dependências dele nesta máquina."
  echo -e "${YELLOW}#${RESET} Se o monolith-nomad já estiver instalado com configurações ou dados personalizados, saiba que este script pode sobrescrever arquivos e configurações existentes. Recomendamos fortemente fazer backup dos dados e das configurações importantes antes de continuar."
  read -p "Tem certeza de que deseja continuar? (s/N): " choice
  case "$choice" in
    y|Y|s|S )
      echo -e "${GREEN}#${RESET} Você escolheu continuar a instalação."
      ;;
    * )
      echo "Você escolheu não continuar a instalação."
      exit 0
      ;;
  esac
}

accept_terms() {
  printf "\n\n"
  echo "Contrato de Licença e Termos de Uso"
  echo "___________________________________"
  printf "\n\n"
  echo "O monolith-nomad é licenciado sob a Apache License 2.0 e é derivado do Project N.O.M.A.D. (Crosstalk Solutions, LLC). O texto completo da licença está em https://www.apache.org/licenses/LICENSE-2.0 e no arquivo LICENSE deste repositório."
  printf "\n"
  echo "Ao aceitar este contrato, você declara que leu e entendeu os termos e condições da Apache License 2.0 e que concorda em cumpri-los ao usar o monolith-nomad."
  echo -e "\n\n"
  read -p "Li e aceito o Contrato de Licença e os Termos de Uso (s/N)? " choice
  case "$choice" in
    y|Y|s|S )
      accepted_terms='true'
      ;;
    * )
      echo "Contrato de Licença e Termos de Uso não aceitos. A instalação não pode continuar."
      exit 1
      ;;
  esac
}

create_nomad_directory(){
  # Ensure the main installation directory exists
  if [[ ! -d "$NOMAD_DIR" ]]; then
    echo -e "${YELLOW}#${RESET} Criando o diretório do monolith-nomad em $NOMAD_DIR...\\n"
    sudo mkdir -p "$NOMAD_DIR"
    sudo chown "$(whoami):$(whoami)" "$NOMAD_DIR"

    echo -e "${GREEN}#${RESET} Diretório criado com sucesso.\\n"
  else
    echo -e "${GREEN}#${RESET} O diretório $NOMAD_DIR já existe.\\n"
  fi

  # Also ensure the directory has a /storage/logs/ subdirectory
  sudo mkdir -p "${NOMAD_DIR}/storage/logs"

  # Create a admin.log file in the logs directory
  sudo touch "${NOMAD_DIR}/storage/logs/admin.log"
}

download_management_compose_file() {
  local compose_file_path="${NOMAD_DIR}/compose.yml"
  local source_file="${1:-}"

  echo -e "${YELLOW}#${RESET} Baixando o arquivo docker-compose de gerenciamento...\\n"
  if [[ -n "$source_file" ]]; then
    # Redirection rather than cp so the file keeps the umask-derived mode that
    # the curl path below produces; cp would copy the temp file's 0600 instead.
    if ! cat "$source_file" > "$compose_file_path"; then
      echo -e "${RED}#${RESET} Falha ao copiar o arquivo docker compose usado na checagem prévia."
      exit 1
    fi
  elif ! curl -fsSL "$MANAGEMENT_COMPOSE_FILE_URL" -o "$compose_file_path"; then
    echo -e "${RED}#${RESET} Falha ao baixar o arquivo docker compose. Confira a URL e tente de novo."
    exit 1
  fi
  echo -e "${GREEN}#${RESET} Arquivo docker compose baixado com sucesso em $compose_file_path.\\n"

  local app_key=$(generateRandomPass)
  local db_root_password=$(generateRandomPass)
  local db_user_password=$(generateRandomPass)

  # If MySQL data directory exists from a previous install attempt, remove it.
  # MySQL only initializes credentials on first startup when the data dir is empty.
  # If stale data exists, MySQL ignores the new passwords above and uses the old ones,
  # causing "Access denied" errors when the admin container tries to connect.
  if [[ -d "${NOMAD_DIR}/mysql" ]]; then
    echo -e "${YELLOW}#${RESET} Removendo o diretório de dados do MySQL existente para que as credenciais coincidam...\\n"
    sudo rm -rf "${NOMAD_DIR}/mysql"
  fi

  # Inject dynamic env values into the compose file
  echo -e "${YELLOW}#${RESET} Configurando as variáveis de ambiente do arquivo docker-compose...\\n"
  sed -i "s|URL=replaceme|URL=http://${local_ip_address}:8080|g" "$compose_file_path"
  sed -i "s|APP_KEY=replaceme|APP_KEY=${app_key}|g" "$compose_file_path"
  
  sed -i "s|DB_PASSWORD=replaceme|DB_PASSWORD=${db_user_password}|g" "$compose_file_path"
  sed -i "s|MYSQL_ROOT_PASSWORD=replaceme|MYSQL_ROOT_PASSWORD=${db_root_password}|g" "$compose_file_path"
  sed -i "s|MYSQL_PASSWORD=replaceme|MYSQL_PASSWORD=${db_user_password}|g" "$compose_file_path"

  # Fuso horário: o do host (ex.: America/Sao_Paulo), para logs e a janela de atualização automática.
  # Sem um nome de fuso válido, fica o padrão do compose.
  local host_tz=''
  host_tz=$(timedatectl show -p Timezone --value 2>/dev/null || true)
  if [[ -z "$host_tz" && -L /etc/localtime ]]; then
    host_tz=$(readlink /etc/localtime | sed 's|.*/zoneinfo/||')
  fi
  if [[ "$host_tz" =~ ^[A-Za-z_]+(/[A-Za-z0-9_+-]+)*$ ]]; then
    sed -i "s|TZ=America/Sao_Paulo|TZ=${host_tz}|g" "$compose_file_path"
    echo -e "${GREEN}#${RESET} Fuso horário: ${host_tz}\\n"
  fi
  
  echo -e "${GREEN}#${RESET} Arquivo docker compose configurado com sucesso.\\n"
}

download_helper_scripts() {
  local start_script_path="${NOMAD_DIR}/start_nomad.sh"
  local stop_script_path="${NOMAD_DIR}/stop_nomad.sh"
  local update_script_path="${NOMAD_DIR}/update_nomad.sh"

  echo -e "${YELLOW}#${RESET} Baixando os scripts auxiliares...\\n"
  if ! curl -fsSL --retry 5 --retry-delay 3 "$START_SCRIPT_URL" -o "$start_script_path"; then
    echo -e "${RED}#${RESET} Falha ao baixar o script de inicialização (start). Confira a URL e tente de novo."
    exit 1
  fi
  chmod +x "$start_script_path"

  if ! curl -fsSL --retry 5 --retry-delay 3 "$STOP_SCRIPT_URL" -o "$stop_script_path"; then
    echo -e "${RED}#${RESET} Falha ao baixar o script de parada (stop). Confira a URL e tente de novo."
    exit 1
  fi
  chmod +x "$stop_script_path"

  if ! curl -fsSL --retry 5 --retry-delay 3 "$UPDATE_SCRIPT_URL" -o "$update_script_path"; then
    echo -e "${RED}#${RESET} Falha ao baixar o script de atualização (update). Confira a URL e tente de novo."
    exit 1
  fi
  chmod +x "$update_script_path"

  echo -e "${GREEN}#${RESET} Scripts auxiliares baixados com sucesso: $start_script_path, $stop_script_path e $update_script_path.\\n"
}

start_management_containers() {
  echo -e "${YELLOW}#${RESET} Iniciando os containers de gerenciamento com o docker compose...\\n"
  if ! sudo docker compose -p project-nomad -f "${NOMAD_DIR}/compose.yml" up -d; then
    echo -e "${RED}#${RESET} Falha ao iniciar os containers de gerenciamento. Confira os logs e tente de novo."
    exit 1
  fi
  echo -e "${GREEN}#${RESET} Containers de gerenciamento iniciados com sucesso.\\n"
}

get_local_ip() {
  local_ip_address=$(hostname -I | awk '{print $1}')
  if [[ -z "$local_ip_address" ]]; then
    echo -e "${RED}#${RESET} Não foi possível descobrir o endereço IP local. Confira a configuração de rede."
    exit 1
  fi
}

# Prints "<port> <protocol>" for every host port published by the compose file.
# Ranges such as "6333-6334:6333-6334" are expanded so each host port is checked.
get_published_management_ports() {
  local compose_file="$1"

  awk '
    /^[[:space:]]+ports:[[:space:]]*$/ { in_ports = 1; next }
    in_ports && /^[[:space:]]+-[[:space:]]*/ {
      value = $0
      sub(/^[[:space:]]+-[[:space:]]*"?/, "", value)
      sub(/"?[[:space:]]*(#.*)?$/, "", value)

      protocol = "tcp"
      if (value ~ /\//) {
        protocol = value
        sub(/^.*\//, "", protocol)
        sub(/\/.*$/, "", value)
      }

      count = split(value, parts, ":")
      if (count < 2) next
      host_ports = parts[count - 1]

      if (host_ports ~ /^[0-9]+-[0-9]+$/) {
        split(host_ports, bounds, "-")
        for (port = bounds[1]; port <= bounds[2]; port++) print port, protocol
      } else if (host_ports ~ /^[0-9]+$/) {
        print host_ports, protocol
      }
      next
    }
    in_ports && /^[[:space:]]+[[:alnum:]_-]+:/ { in_ports = 0 }
  ' "$compose_file" | sort -u -k1,1n -k2,2
}

get_propagation_mount_paths() {
  local compose_file="$1"

  awk '
    /:[^#]*:(ro,)?r?(shared|slave)(,|[[:space:]#]|$)/ {
      value = $0
      sub(/^[[:space:]]+-[[:space:]]*"?/, "", value)
      sub(/"?[[:space:]]*(#.*)?$/, "", value)
      sub(/:[^:]*:(ro,)?r?(shared|slave).*/, "", value)
      # Only host paths have mount propagation; a named volume is not inspectable.
      if (value ~ /^[\/.~]/) print value
    }
  ' "$compose_file" | sort -u
}

mount_propagation_for_path() {
  findmnt -no PROPAGATION --target "$1" 2>/dev/null
}

is_port_in_use() {
  local port="$1"
  local protocol="${2:-tcp}"
  local family='-t'

  [[ "$protocol" == "udp" ]] && family='-u'
  ss -H -ln "$family" "sport = :${port}" 2>/dev/null | grep -q .
}

run_host_preflight() {
  local compose_file="$1"
  local mount_path propagation port protocol
  local failed=false
  local port_conflict=false

  while IFS= read -r mount_path; do
    [[ -z "$mount_path" ]] && continue
    if ! propagation=$(mount_propagation_for_path "$mount_path"); then
      echo -e "${RED}#${RESET} Não foi possível inspecionar a propagação de montagem (mount propagation) de ${mount_path}. Verifique se o findmnt está instalado e se o caminho existe."
      failed=true
    elif [[ "$propagation" != shared* && "$propagation" != slave* ]]; then
      echo -e "${RED}#${RESET} A montagem ${mount_path} usa a propagação '${propagation}'; para os containers de gerenciamento, a propagação de montagem precisa ser shared ou slave."
      echo -e "${RED}#${RESET} Configure a montagem do host como shared e rode o instalador de novo."
      failed=true
    fi
  done < <(get_propagation_mount_paths "$compose_file")

  if ! command -v ss &> /dev/null; then
    echo -e "${RED}#${RESET} Não foi possível inspecionar as portas de gerenciamento porque o comando 'ss' não está disponível. Instale o iproute2 e rode o instalador de novo."
    failed=true
  else
    while read -r port protocol; do
      [[ -z "$port" ]] && continue
      if is_port_in_use "$port" "$protocol"; then
        echo -e "${RED}#${RESET} A porta ${port}/${protocol} já está em uso. Pare o serviço que está usando a porta ou libere-a e rode o instalador de novo."
        port_conflict=true
        failed=true
      fi
    done < <(get_published_management_ports "$compose_file")

    if [[ "$port_conflict" == true ]]; then
      echo -e "${RED}#${RESET} Se o monolith-nomad já estiver instalado neste host, é normal que essas portas estejam em uso. Rodar o instalador de novo não serve para atualizar e vai zerar o banco de dados."
    fi
  fi

  if [[ "$failed" == true ]]; then
    echo -e "${RED}#${RESET} A checagem prévia do host do monolith-nomad falhou antes de qualquer recurso da instalação ser criado."
    exit 1
  fi

  echo -e "${GREEN}#${RESET} Propagação de montagem do host e portas de gerenciamento verificadas.\\n"
}

cleanup_preflight_compose_file() {
  if [[ -n "$preflight_compose_file" ]]; then
    rm -f "$preflight_compose_file"
  fi
}

verify_gpu_setup() {
  # This function only displays GPU setup status and is completely non-blocking
  # It never exits or returns error codes - purely informational
  
  echo -e "\\n${YELLOW}#${RESET} Verificação da GPU\\n"
  echo -e "${YELLOW}===========================================${RESET}\\n"
  
  # Check if NVIDIA GPU is present
  if command -v nvidia-smi &> /dev/null; then
    echo -e "${GREEN}✓${RESET} GPU NVIDIA detectada:"
    nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>/dev/null | while read -r line; do
      echo -e "  ${WHITE_R}$line${RESET}"
    done
    echo ""
  else
    echo -e "${YELLOW}○${RESET} Nenhuma GPU NVIDIA detectada (nvidia-smi indisponível)\\n"
  fi
  
  # Check if NVIDIA Container Toolkit is installed
  if command -v nvidia-ctk &> /dev/null; then
    echo -e "${GREEN}✓${RESET} NVIDIA Container Toolkit instalado: $(nvidia-ctk --version 2>/dev/null | head -n1)\\n"
  else
    echo -e "${YELLOW}○${RESET} NVIDIA Container Toolkit não instalado\\n"
  fi
  
  # Check if Docker has NVIDIA runtime
  if docker info 2>/dev/null | grep -q "nvidia"; then
    echo -e "${GREEN}✓${RESET} Runtime NVIDIA do Docker configurado\\n"
  else
    echo -e "${YELLOW}○${RESET} Runtime NVIDIA do Docker não detectado\\n"
  fi
  
  # Check for AMD GPU — restrict to display controller classes to avoid false positives
  # from AMD CPU host bridges, PCI bridges, and chipset devices.
  local has_amd_gpu='false'
  local amd_gfx_version=''
  if command -v lspci &> /dev/null; then
    if lspci 2>/dev/null | grep -iE "VGA|3D controller|Display" | grep -iE "amd|radeon" &> /dev/null; then
      has_amd_gpu='true'
      echo -e "${GREEN}✓${RESET} GPU AMD detectada: a aceleração ROCm será configurada automaticamente quando o Assistente de IA for instalado.\\n"

      # Map AMD codename → gfx version so the admin can pick the right HSA_OVERRIDE_GFX_VERSION.
      # gfx1030/1100/1101/1102 are on AMD's official ROCm allowlist and need NO override —
      # forcing one (e.g. 11.0.0) breaks GPU discovery on these. Other variants do need it.
      local amd_devices
      amd_devices=$(lspci -vmm 2>/dev/null | awk -F'\t' '/^Class:.*(VGA|3D|Display)/{c=1} c && /^Device:/{print $2; c=0}')
      if echo "${amd_devices}" | grep -iq 'Navi 21'; then
        amd_gfx_version='gfx1030'
      elif echo "${amd_devices}" | grep -iq 'Navi 22'; then
        amd_gfx_version='gfx1031'
      elif echo "${amd_devices}" | grep -iq 'Navi 23'; then
        amd_gfx_version='gfx1032'
      elif echo "${amd_devices}" | grep -iq 'Navi 24'; then
        amd_gfx_version='gfx1034'
      elif echo "${amd_devices}" | grep -iq 'Rembrandt'; then
        amd_gfx_version='gfx1035'
      elif echo "${amd_devices}" | grep -iEq 'Phoenix[0-9]?|Hawk ?Point ?[0-9]?|Radeon (780M|760M)'; then
        # Phoenix (Ryzen 7040) / Hawk Point (Ryzen 8040) — 780M & 760M are both gfx1103.
        # lspci device strings vary (Phoenix1/Phoenix2/Phoenix3, "Hawk Point", "HawkPoint1", or the bare
        # "Radeon 780M Graphics" marketing name), so match all of them or the marker goes
        # missing and the 780M silently drops to CPU. Kept before the Strix branches so a
        # "Radeon 780M" string can't be miscaught. See gfx1103 regression.
        amd_gfx_version='gfx1103'
      elif echo "${amd_devices}" | grep -iEq 'Strix Halo'; then
        amd_gfx_version='gfx1151'
      elif echo "${amd_devices}" | grep -iEq 'Strix( Point)?'; then
        amd_gfx_version='gfx1150'
      elif echo "${amd_devices}" | grep -iq 'Navi 31'; then
        amd_gfx_version='gfx1100'
      elif echo "${amd_devices}" | grep -iq 'Navi 32'; then
        amd_gfx_version='gfx1101'
      elif echo "${amd_devices}" | grep -iq 'Navi 33'; then
        amd_gfx_version='gfx1102'
      elif echo "${amd_devices}" | grep -iq 'Navi 44'; then
        # RDNA 4: Radeon RX 9060 XT / 9050. Verified: lspci "Navi 44 [Radeon RX 9050 / 9060 XT]",
        # KFD gfx_target_version 120000. On the ollama:rocm allowlist, so the admin applies no override.
        amd_gfx_version='gfx1200'
      elif echo "${amd_devices}" | grep -iq 'Navi 48'; then
        # RDNA 4: Radeon RX 9070 / 9070 XT / 9070 GRE — natively supported as well.
        amd_gfx_version='gfx1201'
      fi
    fi
  fi

  # Write detected GPU type to a marker file the admin container can read. The admin
  # container lacks lspci and AMD GPUs don't register a Docker runtime, so this is the
  # only reliable way for the admin to know an AMD GPU is present at install time.
  local gpu_marker_path="${NOMAD_DIR}/storage/.nomad-gpu-type"
  if command -v nvidia-smi &> /dev/null; then
    echo 'nvidia' | sudo tee "${gpu_marker_path}" > /dev/null 2>&1 || true
  elif [[ "${has_amd_gpu}" == 'true' ]]; then
    echo 'amd' | sudo tee "${gpu_marker_path}" > /dev/null 2>&1 || true
  else
    sudo rm -f "${gpu_marker_path}" 2>/dev/null || true
  fi

  # Companion marker used by the admin to pick the right HSA_OVERRIDE_GFX_VERSION for
  # the detected card. Absence of this file means "unknown gfx" — the admin falls back
  # to its built-in default. Always rewrite (or remove) on install to keep state fresh.
  local amd_gfx_marker_path="${NOMAD_DIR}/storage/.nomad-amd-gfx"
  if [[ -n "${amd_gfx_version}" ]]; then
    echo "${amd_gfx_version}" | sudo tee "${amd_gfx_marker_path}" > /dev/null 2>&1 || true
  else
    sudo rm -f "${amd_gfx_marker_path}" 2>/dev/null || true
  fi

  echo -e "${YELLOW}===========================================${RESET}\\n"

  # Summary
  if command -v nvidia-smi &> /dev/null && docker info 2>/dev/null | grep -q "nvidia"; then
    echo -e "${GREEN}#${RESET} A aceleração por GPU está configurada! O Assistente de IA vai usar a sua GPU.\\n"
  elif [[ "${has_amd_gpu}" == 'true' ]]; then
    echo -e "${GREEN}#${RESET} A aceleração por GPU (AMD/ROCm) será ativada quando o Assistente de IA for instalado pelo painel.\\n"
  else
    echo -e "${YELLOW}#${RESET} Aceleração por GPU não detectada. O Assistente de IA vai rodar só na CPU.\\n"
    if command -v nvidia-smi &> /dev/null && ! docker info 2>/dev/null | grep -q "nvidia"; then
      echo -e "${YELLOW}#${RESET} Dica: a GPU foi detectada, mas o runtime do Docker não está configurado.\\n"
      echo -e "${YELLOW}#${RESET} Tente reiniciar o Docker: ${WHITE_R}sudo systemctl restart docker${RESET}\\n"
    fi
  fi
}

success_message() {
  echo -e "${GREEN}#${RESET} Instalação do monolith-nomad concluída com sucesso!\\n"
  echo -e "${GREEN}#${RESET} Os arquivos da instalação ficam em /opt/project-nomad\\n\n"
  echo -e "${GREEN}#${RESET} A Central de Comando do monolith-nomad deve iniciar sozinha sempre que o computador reiniciar. Se precisar iniciá-la manualmente, execute: ${WHITE_R}${NOMAD_DIR}/start_nomad.sh${RESET}\\n"
  echo -e "${GREEN}#${RESET} Acesse a interface de gerenciamento em http://localhost:8080 ou http://${local_ip_address}:8080\\n"
  echo -e "${GREEN}#${RESET} Obrigado por usar o monolith-nomad!\\n"
}

###################################################################################################################################################################################################
#                                                                                                                                                                                                 #
#                                                                                           Main Script                                                                                           #
#                                                                                                                                                                                                 #
###################################################################################################################################################################################################

main() {
  # Pre-flight checks
  check_is_debian_based
  check_is_x86_64
  check_is_bash
  check_has_sudo
  ensure_dependencies_installed
  check_is_debug_mode

  # Main install
  banner
  get_install_confirmation
  accept_terms
  ensure_docker_installed
  check_docker_compose
  setup_nvidia_container_toolkit
  get_local_ip

  resolve_nomad_source || exit 1
  echo -e "${GREEN}#${RESET} Arquivos de instalação: ${NOMAD_RAW_BASE_URL}\n"

  preflight_compose_file=$(mktemp)
  trap cleanup_preflight_compose_file EXIT
  if ! curl -fsSL "$MANAGEMENT_COMPOSE_FILE_URL" -o "$preflight_compose_file"; then
    echo -e "${RED}#${RESET} Falha ao baixar o arquivo compose de gerenciamento para a checagem prévia do host."
    exit 1
  fi
  run_host_preflight "$preflight_compose_file"

  create_nomad_directory
  download_helper_scripts
  download_management_compose_file "$preflight_compose_file"
  start_management_containers
  verify_gpu_setup
  success_message
}

if [ "${BASH_SOURCE:-$0}" = "$0" ]; then
  main "$@"
fi

# free_space_check() {
#   if [[ "$(df -B1 / | awk 'NR==2{print $4}')" -le '5368709120' ]]; then
#     header_red
#     echo -e "${YELLOW}#${RESET} You only have $(df -B1 / | awk 'NR==2{print $4}' | awk '{ split( "B KB MB GB TB PB EB ZB YB" , v ); s=1; while( $1>1024 && s<9 ){ $1/=1024; s++ } printf "%.1f %s", $1, v[s] }') of disk space available on \"/\"... \\n"
#     while true; do
#       read -rp $'\033[39m#\033[0m Do you want to proceed with running the script? (y/N) ' yes_no
#       case "$yes_no" in
#          [Nn]*|"")
#             free_space_check_response="Cancel script"
#             free_space_check_date="$(date +%s)"
#             echo -e "${YELLOW}#${RESET} OK... Please free up disk space before running the script again..."
#             cancel_script
#             break;;
#          [Yy]*)
#             free_space_check_response="Proceed at own risk"
#             free_space_check_date="$(date +%s)"
#             echo -e "${YELLOW}#${RESET} OK... Proceeding with the script.. please note that failures may occur due to not enough disk space... \\n"; sleep 10
#             break;;
#          *) echo -e "\\n${RED}#${RESET} Invalid input, please answer Yes or No (y/n)...\\n"; sleep 3;;
#       esac
#     done
#     if [[ -n "$(command -v jq)" ]]; then
#       if [[ "$(dpkg-query --showformat='${version}' --show jq 2> /dev/null | sed -e 's/.*://' -e 's/-.*//g' -e 's/[^0-9.]//g' -e 's/\.//g' | sort -V | tail -n1)" -ge "16" && -e "${eus_dir}/db/db.json" ]]; then
#         jq '.scripts."'"${script_name}"'" += {"warnings": {"low-free-disk-space": {"response": "'"${free_space_check_response}"'", "detected-date": "'"${free_space_check_date}"'"}}}' "${eus_dir}/db/db.json" > "${eus_dir}/db/db.json.tmp" 2>> "${eus_dir}/logs/eus-database-management.log"
#       else
#         jq '.scripts."'"${script_name}"'" = (.scripts."'"${script_name}"'" | . + {"warnings": {"low-free-disk-space": {"response": "'"${free_space_check_response}"'", "detected-date": "'"${free_space_check_date}"'"}}})' "${eus_dir}/db/db.json" > "${eus_dir}/db/db.json.tmp" 2>> "${eus_dir}/logs/eus-database-management.log"
#       fi
#       eus_database_move
#     fi
#   fi
# }
