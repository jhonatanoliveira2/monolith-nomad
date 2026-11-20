#!/bin/bash

echo "Procurando os containers Docker do monolith-nomad em execução..."

containers=$(docker ps --filter "name=^nomad_" --format "{{.Names}}")

if [ -z "$containers" ]; then
    echo "Nenhum container do monolith-nomad em execução"
    exit 0
fi

echo "Containers em execução encontrados:"
echo "$containers"
echo ""

for container in $containers; do
    echo "Parando o container com segurança: $container"
    if docker stop "$container"; then
        echo "✓ $container parado com sucesso"
    else
        echo "✗ Falha ao parar $container"
    fi
    echo ""
done

echo "Desligamento seguro de todos os containers do monolith-nomad disparado."
