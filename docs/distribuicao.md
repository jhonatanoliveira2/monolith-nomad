# Distribuição do monolith-nomad (independência do fork)

O instalador, as imagens, as atualizações e os catálogos apontam para **este** repositório, `github.com/jhonatanoliveira2/monolith-nomad`, e para as imagens em `ghcr.io/jhonatanoliveira2/…`. Nada é baixado do projeto original, exceto o conteúdo de terceiros listado ao fim.

## Antes da primeira instalação: publicar as imagens

O compose (`install/management_compose.yaml`) usa as imagens do fork. Elas precisam existir e estar **públicas** no ghcr, senão o `docker compose pull` falha na instalação.

1. No GitHub, abra **Actions** e rode, com `workflow_dispatch`, informando `version` (por exemplo `1.36.0`) e marcando `tag_latest`:
   - **Build Primary Docker Image** → `ghcr.io/jhonatanoliveira2/project-nomad`
   - **Build Sidecar Updater** → `…/project-nomad-sidecar-updater`
   - **Build Disk Collector** → `…/project-nomad-disk-collector`
   - **Build Translate Proxy** → `…/project-nomad-translate`. Use a versão `0.1.2`, que é a do seeder (`service_seeder.ts`).
2. Em **Packages**, abra cada pacote, vá em *Package settings* e mude *Change visibility* para **Public**. Pacotes novos no ghcr nascem privados.
3. Para o atualizador do app encontrar versões, publique uma **release** com tag semver (`v1.36.0`). O app compara com a versão gravada na imagem (o build-arg `VERSION`).

Os workflows publicam em `ghcr.io/<dono do repositório em minúsculas>`. Isso é calculado no passo *Image namespace*, então um novo fork publica no próprio namespace sem editar nada.

## O que aponta para onde

| Peça | Origem | Onde é definida |
|---|---|---|
| Script de instalação | anexo da release: `github.com/jhonatanoliveira2/monolith-nomad/releases/latest/download/install_nomad.sh` | `.releaserc.json` (assets do `@semantic-release/github`) |
| Compose e scripts start/stop/update baixados pelo instalador | `raw.githubusercontent.com/jhonatanoliveira2/monolith-nomad/refs/tags/<última release>/install/…` | `resolve_nomad_source` em `install/install_nomad.sh` e `install/run_updater_fixes.sh` (`NOMAD_RELEASE_TAG`, `NOMAD_GITHUB_REPO`, `NOMAD_GITHUB_BRANCH`) |
| Imagens admin, sidecar e disk-collector | `ghcr.io/jhonatanoliveira2/project-nomad*` | `install/management_compose.yaml` |
| Tag aplicada numa atualização | `NOMAD_IMAGE_REPO` (padrão `ghcr.io/jhonatanoliveira2/project-nomad`) | `install/sidecar-updater/update-watcher.sh` |
| Checagem de versão e atualização automática | `api.github.com/repos/jhonatanoliveira2/monolith-nomad/releases` | `admin/constants/project.ts` |
| Catálogos (`collections/*.json`) | `raw.githubusercontent.com/jhonatanoliveira2/monolith-nomad/…/collections/` | `admin/constants/project.ts` |
| ZIM mini da Wikipédia (pré-instalação do Kiwix) | este repositório, `install/wikipedia_en_100_mini_2026-01.zim` | `docker_service.ts` |
| Imagem do tradutor | `ghcr.io/jhonatanoliveira2/project-nomad-translate:0.1.2` | `service_seeder.ts` |
| Rótulos OCI da imagem | `org.opencontainers.image.source` = este repositório (vincula o pacote do ghcr ao repo) | `Dockerfile` |

**Os nomes técnicos não mudaram, de propósito:** `/opt/project-nomad`, os containers `nomad_*`, o projeto compose `project-nomad`, os nomes base das imagens `project-nomad*` e os cabeçalhos `X-NOMAD-*`. Renomeá-los deixaria containers órfãos e quebraria o caminho de atualização.

### Variáveis (para outro fork ou outra branch)

No `admin` (environment do compose), lidas por `admin/constants/project.ts`:

| variável | padrão |
|---|---|
| `NOMAD_GITHUB_REPO` | `jhonatanoliveira2/monolith-nomad` |
| `NOMAD_GITHUB_BRANCH` | `main` |
| `NOMAD_IMAGE_NAMESPACE` | `ghcr.io/jhonatanoliveira2` (convertido para minúsculas) |

No instalador e no `run_updater_fixes.sh` (função `resolve_nomad_source`, testada em `install/tests/install_source_test.sh`):

| variável | padrão | efeito |
|---|---|---|
| `NOMAD_RELEASE_TAG` | vazio: a última release publicada (`/releases/latest`) | fixa uma release (`v1.36.0`) |
| `NOMAD_GITHUB_REPO` | `jhonatanoliveira2/monolith-nomad` | outro fork (validado: `dono/repo`) |
| `NOMAD_GITHUB_BRANCH` | vazio | **opção explícita de desenvolvimento**: baixa do branch, com aviso |

Os arquivos vêm sempre de uma **release**, e não de um branch que se move: o compose e os scripts batem com as imagens daquela versão. Sem release publicada, o instalador para com uma mensagem clara.

```bash
NOMAD_RELEASE_TAG=v1.36.0 NOMAD_GITHUB_REPO=dono/repo sudo -E bash install_nomad.sh
```

### Pipeline de release (`.github/workflows/release.yml`)

- Só o **dono do repositório** pode disparar (`github.triggering_actor == github.repository_owner`).
- Usa o `GITHUB_TOKEN` do próprio workflow, com permissões explícitas (`contents`, `issues` e `pull-requests: write`). Nenhum segredo, bot ou serviço do projeto original (`COSMISTACKBOT_ACCESS_TOKEN`, `DEPLOYMENT_AUTHORIZED_USERS`, `NOMAD_API_KEY` e `api.projectnomad.us` foram removidos).
- O push das notas de versão usa o credential helper do `gh`, sem token na URL do remote, configurado antes do `git pull --ff-only` (nunca um merge por cima do commit da release). O push vai explícito para `HEAD:main`.
- Expressões `${{ }}` nunca entram no texto dos scripts `run:`: passam por `env:`.
- **Se o `main` tiver proteção de branch**, o `GITHUB_TOKEN` não consegue fazer push. A release sai, mas sem as notas finalizadas no repositório. Nesse caso, libere o `github-actions[bot]` na regra ou finalize as notas por PR.
- Cada release anexa `install_nomad.sh`, `uninstall_nomad.sh` e `management_compose.yaml`.
- **Todas as actions são fixadas por SHA de commit** (com a versão em comentário, por exemplo `# v6.1.0`). Tags podem ser movidas, commits não. Guarda em `admin/tests/unit/repo_hygiene.spec.ts`.

## Serviços online do projeto original: desligados por padrão

Esta distribuição não envia dados para servidores que não opera, nem depende deles. Cada serviço pode ser religado por variável no `admin`:

| Serviço | Comportamento padrão | Para religar |
|---|---|---|
| Leaderboard de benchmark (envio e estatísticas) | a seção "compartilhar" e o link ficam ocultos, e o envio é recusado | `BENCHMARK_LEADERBOARD_URL=https://benchmark.projectnomad.us` |
| Newsletter de release notes | o formulário fica oculto, e nenhum e-mail sai | `RELEASE_NOTES_SUBSCRIBE_URL=https://api.projectnomad.us/api/v1/lists/release-notes/subscribe` |
| Teste de conexão com a internet | só `1.1.1.1/cdn-cgi/trace` e `api.github.com` (sem `api.projectnomad.us`) | `INTERNET_STATUS_TEST_URL` |
| Lista curada de modelos de IA | usa a lista embutida (`FALLBACK_RECOMMENDED_OLLAMA_MODELS`) | `NOMAD_API_URL=https://api.projectnomad.us` |
| Creator Packs (conteúdo restrito) | ficam ocultos sem chave, como já era | `CREATOR_PACKS_APP_KEY` |

## Conteúdo de terceiros que continua no projeto original

São **dados**, não código. Este fork não os hospeda:

- **`Crosstalk-Solutions/project-nomad-maps`**: os mapas regionais `.pmtiles` de `collections/maps.json` e o pacote de assets base dos mapas (`admin/constants/project.ts`, `UPSTREAM_MAPS_REPO`).
- **`ghcr.io/crosstalk-solutions/nomad-sysbench@sha256:1f08e527…`**: a imagem do benchmark de hardware, fixada por digest, que é imutável. O Dockerfile dela não está neste repositório.
- **Creator Packs**: o catálogo e a licença (`collections/creator-pack-license.md`) são do projeto original.

## Verificação

- `admin/tests/unit/fork_independence.spec.ts` falha se instalador, compose, updater, CI, atualização ou catálogos voltarem a apontar para o projeto original. Serve para pegar um merge do upstream que traga URLs fixas de volta.
- Teste de fumaça em 20/11/2026: a imagem `monolith-nomad:dev-aria2` foi executada com MySQL 8 e Redis 7, numa rede isolada e sem o socket do Docker. Resultado:
  - migrations, seeder e workers iniciaram;
  - o prop `project` chegou com o repositório do fork e os serviços upstream desligados;
  - o banco gravou a imagem do tradutor do fork;
  - o log não mencionou o projeto original nenhuma vez;
  - a checagem de versão consultou `api.github.com/repos/jhonatanoliveira2/monolith-nomad/releases/latest` e recebeu 404, porque ainda não havia release publicada.
- `install/tests/install_nomad_preflight_test.sh` passa. Antes, ele falhava porque o upstream (`fe2f0bc`) mudou a guarda do script sem atualizar o teste.
