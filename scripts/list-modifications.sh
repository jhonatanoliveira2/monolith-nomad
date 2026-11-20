#!/bin/bash
#
# Prints MODIFICATIONS.md: every file this distribution added, modified or removed relative to the upstream
# Project N.O.M.A.D. commit it is based on (Apache License 2.0, section 4(b): modified files must carry a
# prominent notice that they were changed). Committed and uncommitted changes are both included.
#
# Usage (repository root):  bash scripts/list-modifications.sh > MODIFICATIONS.md
# Checked by admin/tests/unit/repo_hygiene.spec.ts.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

BASE="${BASE:-f633b36}"

if ! git cat-file -e "${BASE}^{commit}" 2>/dev/null; then
  echo "base commit ${BASE} not found (shallow clone?)" >&2
  exit 1
fi

rows() {
  git diff --name-status --no-renames "$BASE" -- . | while IFS=$'\t' read -r status file; do
    [[ "$file" == "MODIFICATIONS.md" ]] && continue
    case "$status" in
      A) echo "Adicionado|$file" ;;
      D) echo "Removido|$file" ;;
      *) echo "Modificado|$file" ;;
    esac
  done
  git ls-files --others --exclude-standard | while read -r file; do
    [[ "$file" == "MODIFICATIONS.md" ]] && continue
    echo "Adicionado|$file"
  done
}

mapfile -t entries < <(rows | sort -t'|' -k2,2 -u)
count() { printf '%s\n' "${entries[@]}" | grep -c "^$1|" || true; }

cat <<EOF
# Arquivos modificados (Apache License 2.0, seção 4(b))

O **monolith-nomad** é uma obra derivada do [Project N.O.M.A.D.](https://github.com/Crosstalk-Solutions/project-nomad)
(Copyright Crosstalk Solutions, LLC, Apache License 2.0). **Os arquivos abaixo foram alterados, adicionados ou
removidos pelo mantenedor do monolith-nomad** em relação ao commit \`${BASE}\` do projeto original (versão
1.35.2-rc.1). Os arquivos que não aparecem aqui estão como no original.

O que mudou e por quê está descrito no [\`CHANGELOG.md\`](CHANGELOG.md) e em [\`docs/\`](docs/). Créditos e licenças de
terceiros: [\`THIRD_PARTY_NOTICES.md\`](THIRD_PARTY_NOTICES.md).

Gerado por \`scripts/list-modifications.sh\` (não edite à mão): $(count Modificado) modificados, $(count Adicionado)
adicionados, $(count Removido) removidos.

| Situação | Arquivo |
|---|---|
EOF
for entry in "${entries[@]}"; do
  printf '| %s | `%s` |\n' "${entry%%|*}" "${entry#*|}"
done
