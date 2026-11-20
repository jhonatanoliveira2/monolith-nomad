#!/bin/bash

echo "Procurando os containers do monolith-nomad..."

# -a to include all containers (running and stopped)
containers=$(docker ps -a --filter "name=^nomad_" --format "{{.Names}}")

if [ -z "$containers" ]; then
    echo "Nenhum container do monolith-nomad encontrado. Ele está instalado?"
    exit 0
fi

echo "Containers encontrados:"
echo "$containers"
echo ""

for container in $containers; do
    echo "Iniciando o container: $container"
    if docker start "$container"; then
        echo "✓ $container iniciado com sucesso"
    else
        echo "✗ Falha ao iniciar $container"
    fi
    echo ""
done

echo "Inicialização de todos os containers do monolith-nomad disparada."
