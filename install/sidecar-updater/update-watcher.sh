#!/bin/bash

# Project NOMAD Update Sidecar - Polls for update requests and executes them

SHARED_DIR="/shared"
REQUEST_FILE="${SHARED_DIR}/update-request"
STATUS_FILE="${SHARED_DIR}/update-status"
LOG_FILE="${SHARED_DIR}/update-log"
COMPOSE_FILE="/opt/project-nomad/compose.yml"
COMPOSE_PROJECT_NAME="project-nomad"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

write_status() {
    local stage="$1"
    local progress="$2"
    local message="$3"
    
    cat > "$STATUS_FILE" <<EOF
{
  "stage": "$stage",
  "progress": $progress,
  "message": "$message",
  "timestamp": "$(date -Iseconds)"
}
EOF
}

# Tags the updater accepts: "latest" or a release version (1.35.2, v1.35.2, v1.35.2-rc.1). The tag goes into
# the sed below, run on the host's compose.yml, so anything else (|, &, \\, spaces, newlines) is refused.
# Same rule as the admin's admin/app/utils/image_tag.ts (both checked in admin/tests/unit/image_tag.spec.ts).
is_valid_image_tag() {
    [[ ${#1} -le 128 && "$1" =~ ^(latest|v?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?)$ ]]
}

perform_update() {
    local target_tag="$1"

    if ! is_valid_image_tag "$target_tag"; then
        log "ERRO: tag de imagem inválida no pedido de atualização; nada foi alterado"
        write_status "error" 0 "Tag de imagem inválida no pedido de atualização"
        return 1
    fi

    log "Pedido de atualização recebido: iniciando a atualização do sistema (tag de destino: ${target_tag})"

    # Clear old logs
    > "$LOG_FILE"

    # Stage 1: Starting
    write_status "starting" 0 "Atualização do sistema iniciada"
    log "Atualização do sistema iniciada"
    sleep 1

    # Apply target image tag to compose.yml before pulling
    log "Aplicando a tag de imagem '${target_tag}' ao compose.yml..."
    # Only the admin image line ("<repo>:" right after the name, so the -sidecar-updater/-disk-collector
    # images are untouched). NOMAD_IMAGE_REPO: this distribution's admin image (monolith-nomad).
    local image_repo="${NOMAD_IMAGE_REPO:-ghcr.io/jhonatanoliveira2/project-nomad}"
    local image_re="${image_repo//./\\.}"
    if sed -i "s|\(image: ${image_re}\):.*|\1:${target_tag}|" "$COMPOSE_FILE" 2>> "$LOG_FILE"; then
        log "Tag da imagem do admin no compose.yml atualizada para '${target_tag}'"
    else
        log "ERRO: falha ao atualizar a tag de imagem no compose.yml"
        write_status "error" 0 "Falha ao atualizar a tag de imagem no compose.yml. Confira os logs"
        return 1
    fi

    # Stage 2: Pulling images
    write_status "pulling" 20 "Baixando as imagens Docker mais recentes..."
    log "Baixando as imagens Docker mais recentes..."

    # Snapshot the images backing our managed repos before the pull supersedes
    # them, so the post-update cleanup can drop only NOMAD's own dangling layers.
    PRE_UPDATE_IMAGE_IDS=$(snapshot_managed_image_ids)

    if docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" pull >> "$LOG_FILE" 2>&1; then
        log "Imagens mais recentes baixadas com sucesso"
        write_status "pulled" 60 "Imagens baixadas com sucesso"
    else
        log "ERRO: falha ao baixar as imagens"
        write_status "error" 0 "Falha ao baixar as imagens Docker. Confira os logs"
        return 1
    fi
    
    sleep 2
    
    # Stage 3: Recreating containers individually (excluding updater)
    write_status "recreating" 65 "Recriando os containers um a um..."
    log "Recriando os containers um a um (exceto o atualizador)..."
    
    # List of services to update (excluding updater)
    SERVICES_TO_UPDATE="admin mysql redis dozzle"
    
    local current_progress=65
    local progress_per_service=8  # (95 - 65) / 4 services ≈ 8% per service
    
    for service in $SERVICES_TO_UPDATE; do
        log "Atualizando o serviço: $service"
        write_status "recreating" $current_progress "Recriando $service..."
        
        # Stop the service
        log "  Parando $service..."
        docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" stop "$service" >> "$LOG_FILE" 2>&1 || log "  AVISO: falha ao parar $service"
        
        # Remove the container
        log "  Removendo o container antigo de $service..."
        docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" rm -f "$service" >> "$LOG_FILE" 2>&1 || log "  AVISO: falha ao remover $service"
        
        # Recreate and start with new image
        log "  Iniciando o novo container de $service..."
        if docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" up -d --no-deps "$service" >> "$LOG_FILE" 2>&1; then
            log "  ✓ $service recriado com sucesso"
        else
            log "  ERRO: falha ao recriar $service"
            write_status "error" $current_progress "Falha ao recriar $service. Confira os logs"
            return 1
        fi
        
        current_progress=$((current_progress + progress_per_service))
    done
    
    log "Todos os containers foram recriados com sucesso"

    # Stage 4: Reclaim disk from superseded images (best-effort; never fails the update)
    prune_old_images

    write_status "complete" 100 "Atualização do sistema concluída com sucesso"
    log "Atualização do sistema concluída com sucesso"

    return 0
}

# Record the full image IDs currently backing our compose-managed repositories
# BEFORE we pull. After the pull, the old digests of moving tags (e.g. :latest)
# become dangling <none> images; knowing their IDs lets the cleanup target only
# NOMAD's own images and leave every other app's dangling images on this shared
# host's Docker daemon alone. --no-trunc so IDs match `docker images` output later.
snapshot_managed_image_ids() {
    local managed_repos
    managed_repos=$(docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" config --images 2>/dev/null \
        | sed 's/[:@].*$//' | sort -u)
    [ -z "$managed_repos" ] && return 0
    docker images --no-trunc --format '{{.Repository}} {{.ID}}' | while IFS=' ' read -r repo id; do
        echo "$managed_repos" | grep -qxF "$repo" && echo "$id"
    done | sort -u
}

# Reclaim disk left behind by updates. Every update pulls new image versions but
# never removed the old ones, so /var/lib/containerd grows unbounded across
# releases (observed 50+ GB of orphaned layers on long-running installs; issue
# #858). This runs only after a confirmed-successful recreate.
#
# Deliberately conservative for an offline-first appliance: we do NOT run
# `docker system/image prune -a`, which would delete images for installed-but-
# stopped Supply Depot / curated services and force a re-pull that fails with no
# internet. Instead we (1) drop dangling layers and (2) remove only superseded
# tags of the core services this updater manages (the images in compose.yml),
# keeping the refs now in use. Optional/offline images are never touched.
prune_old_images() {
    write_status "pruning" 97 "Liberando espaço em disco das imagens antigas..."
    log "Removendo imagens Docker substituídas para liberar espaço em disco..."

    # 1. Drop the prior image layers this update left dangling — but ONLY ours.
    #    We snapshotted the managed repos' image IDs before pulling; any of those
    #    IDs now untagged (<none>) is a superseded NOMAD image, safe to remove.
    #    We deliberately do NOT run `docker image prune`, which would also delete
    #    unrelated dangling images from other apps sharing this host's daemon.
    if [ -n "$PRE_UPDATE_IMAGE_IDS" ]; then
        local dangling_now
        dangling_now=$(docker images --no-trunc --filter 'dangling=true' --quiet | sort -u)
        while read -r id; do
            [ -z "$id" ] && continue
            echo "$dangling_now" | grep -qxF "$id" || continue   # keep unless now dangling
            log "  Removendo camada órfã substituída: $id"
            # No -f: docker refuses if a container still references it, so
            # anything unexpectedly in use is safely skipped.
            docker rmi "$id" >> "$LOG_FILE" 2>&1 || log "  $id mantido (ainda em uso ou a remoção falhou)"
        done <<< "$PRE_UPDATE_IMAGE_IDS"
    else
        log "  Sem registro das imagens anteriores à atualização; pulando a limpeza de camadas órfãs"
    fi

    # 2. Superseded tags of compose-managed repositories only.
    local in_use_raw in_use managed_repos
    in_use_raw=$(docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" config --images 2>/dev/null)
    # `compose config --images` emits an untagged repo as a bare name, but
    # `docker images` always reports `repo:tag`. Normalise bare refs to `:latest`
    # so the in-use check below matches (otherwise the current image, e.g. the
    # updater's own, looks superseded). Digest refs are left as-is.
    in_use=$(echo "$in_use_raw" | while read -r r; do
        [ -z "$r" ] && continue
        case "${r##*/}" in
            *:*|*@*) echo "$r" ;;
            *) echo "$r:latest" ;;
        esac
    done | sort -u)
    if [ -z "$in_use" ]; then
        log "  Não foi possível identificar as imagens em uso pelo compose; limpeza direcionada pulada"
        log "Limpeza de imagens concluída"
        return 0
    fi

    # Repositories we manage = the in-use refs with the tag/digest stripped off.
    managed_repos=$(echo "$in_use" | sed 's/[:@].*$//' | sort -u)

    while IFS=' ' read -r _img_id img_ref; do
        [ -z "$img_ref" ] && continue
        local repo="${img_ref%%:*}"
        # Only touch repositories this updater manages.
        echo "$managed_repos" | grep -qxF "$repo" || continue
        # Keep any ref that is still in use by the current stack.
        echo "$in_use" | grep -qxF "$img_ref" && continue
        log "  Removendo imagem substituída: $img_ref"
        # No -f: docker refuses to remove an image still referenced by a
        # container, which keeps us safe against removing anything in use.
        docker rmi "$img_ref" >> "$LOG_FILE" 2>&1 || log "  $img_ref mantida (ainda em uso ou a remoção falhou)"
    done < <(docker images --format '{{.ID}} {{.Repository}}:{{.Tag}}' | grep -v '<none>')

    log "Limpeza de imagens concluída"
}

cleanup() {
    log "Sidecar de atualização encerrando"
    exit 0
}

trap cleanup SIGTERM SIGINT

# Main watch loop
log "Sidecar de atualização iniciado: aguardando pedidos de atualização"
write_status "idle" 0 "Pronto para pedidos de atualização"

while true; do
    # Check if an update request file exists
    if [ -f "$REQUEST_FILE" ]; then
        log "Arquivo de pedido de atualização encontrado"
        
        # Read request details
        REQUEST_DATA=$(cat "$REQUEST_FILE" 2>/dev/null || echo "{}")
        log "Dados do pedido: $REQUEST_DATA"

        # Extract target tag from request (defaults to "latest" if not provided)
        TARGET_TAG=$(echo "$REQUEST_DATA" | jq -r '.target_tag // "latest"')
        log "Tag de imagem de destino: ${TARGET_TAG}"

        # Remove the request file to prevent re-processing
        rm -f "$REQUEST_FILE"

        if perform_update "$TARGET_TAG"; then
            log "Atualização concluída com sucesso"
        else
            log "A atualização falhou. Veja os detalhes nos logs"
        fi
        
        sleep 5
        write_status "idle" 0 "Pronto para pedidos de atualização"
    fi
    
    # Sleep before next check (1 second polling)
    sleep 1
done
