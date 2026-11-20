# Changelog do monolith-nomad

Mudanças desta distribuição em relação ao Project N.O.M.A.D. (base `1.35.2-rc.1`, commit `f633b36`). As notas de versão do projeto original continuam em [`admin/docs/release-notes.md`](admin/docs/release-notes.md), em inglês.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [1.0.0] - 2026-11-20

Primeira versão do monolith-nomad. A numeração própria começa em 1.0.0; a base é o Project N.O.M.A.D. 1.35.2-rc.1.

### Adicionado

- **Downloads inteligentes** ([`docs/downloads.md`](docs/downloads.md)):
  - mirrors oficiais do Kiwix, com SHA-256, lidos do metalink (`.meta4`) de `download.kiwix.org`;
  - benchmark real dos mirrors (GET ranged, medido na segunda metade da amostra) e ranking por desempenho medido; a localização só desempata;
  - **aria2c** como motor padrão: todas as conexões no melhor mirror, os demais como reserva (`--uri-selector=inorder`), SHA-256 conferido pelo aria2c, credenciais enviadas pelo stdin e só para a origem;
  - motor nativo como fallback: uma fonte por vez, retomando o mesmo `.tmp`, com backoff exponencial e jitter;
  - verificação de SHA-256 antes de instalar qualquer arquivo; limites de conexão publicados pelos servidores são respeitados (`dumps.wikimedia.org`: 1 por download);
  - preferências por variável de ambiente (`DOWNLOAD_*`), com padrão São Paulo/Brasil.
- **Independência do fork** ([`docs/distribuicao.md`](docs/distribuicao.md)):
  - `admin/constants/project.ts` concentra repositório, branch, namespace das imagens, releases e catálogos, todos sobrescrevíveis por variável de ambiente;
  - instalador, compose, atualizador, CI e catálogos apontam para `jhonatanoliveira2/monolith-nomad` e `ghcr.io/jhonatanoliveira2`;
  - teste de guarda `fork_independence.spec.ts` contra merges do upstream que tragam URLs do projeto original de volta.
- **Tema Nothing:**
  - fundo preto OLED, tons de cinza, textura de pontos;
  - fontes Doto, Space Grotesk e Space Mono incluídas no app (OFL);
  - botões em pílula e LEDs nos cabeçalhos de seção;
  - tema escuro como padrão, com o claro monocromático disponível.
- **Logo** monocromática do Ubuntu (Circle of Friends) no app e no favicon, com aviso de marca da Canonical em `THIRD_PARTY_NOTICES.md`.
- **pt-BR como idioma padrão:**
  - i18next com o texto em inglês como chave e catálogos em `admin/inertia/locales/pt-BR/`;
  - seletor de idioma (PT/EN);
  - datas e números no formato brasileiro (`lib/format.ts`);
  - documentação do app em `admin/docs/*.pt-BR.md`, com o inglês como reserva;
  - instalador e documentos do repositório traduzidos.
- `THIRD_PARTY_NOTICES.md` com origens, licenças e marcas.
- Teste de guarda do mapeamento AMD RDNA4.
- Testes do motor nativo de download (retry, retomada por Range, SHA-256, idempotência, conteúdo recusado), do benchmark de mirrors, da tradução das mensagens do servidor e da formatação pt-BR. `server_messages` e `format` foram separados em módulos puros (`*_core.ts`) para poderem ser testados fora do Vite.

### Alterado

- Os serviços online do projeto original vêm **desligados por padrão**: leaderboard de benchmark, newsletter, `api.projectnomad.us` no teste de internet e lista remota de modelos de IA. Cada um pode ser religado por variável de ambiente.
- A página "Support the Project" virou **Sobre e Suporte**, sem os links promocionais de doação, Discord e banner.
- Os rótulos OCI da imagem deixaram de apresentá-la como imagem oficial do projeto original.
- Medidores de CPU, memória e swap: neutros abaixo de 70 %, laranja de 70 a 89 %, vermelho a partir de 90 %. Antes, o uso baixo aparecia em vermelho (`scale="usage"`).
- Tradutor (`nomad-translate`): o português é o primeiro idioma padrão (`pt,es,fr,de`). O download dos modelos confere o SHA-256 publicado pelo Firefox Remote Settings e faz retry com backoff.
- O container `admin` usa `TZ` (padrão `America/Sao_Paulo`, trocado pelo instalador pelo fuso do host): logs e a janela de atualização automática ficam no horário local.
- Os downloads usam o User-Agent `monolith-nomad/1.0`.

### Corrigido

- O teste do instalador (`install_nomad_preflight_test.sh`) ainda procurava a guarda antiga do script, alterada no upstream em `fe2f0bc`, e por isso falhava.
- A amostra do benchmark de mirrors media principalmente o início lento do TCP e ordenava mal mirrors parecidos.
- **Tema escuro com caixas claras:** os prefixos `dark:` seguiam o `prefers-color-scheme` do sistema operacional, e não o tema escolhido no app (bug que já vinha do upstream). Agora seguem o `data-theme` (`@custom-variant dark` no `app.css`).
- **Cores fixas fora do tema:** cerca de 190 classes de paleta do Tailwind (`bg-red-50`, `text-amber-700`, `text-blue-600`…) em 38 arquivos foram trocadas pelos tokens do tema Nothing, e os `dark:` redundantes saíram. Os alertas, avisos e badges agora acompanham os dois temas.
- **Contraste das cores semânticas:** a rampa laranja não se invertia no tema escuro, e o badge "education" do Depósito de Apps ficava com texto claro sobre fundo claro. No tema claro, os fundos tingidos de erro, aviso e sucesso tinham contraste de 3,2 a 4,4:1 com o texto. Agora todos passam de 6:1. Os botões danger e success e o badge de atualização usavam no hover um tom que clareia no escuro, com cerca de 2:1 contra o texto branco; agora usam os tokens `desert-*-hover`. O teste `theme_tokens.spec.ts` protege essas regras.

- **Segurança dos downloads** (achados da revisão de código):
  - um metalink sem SHA-256 não traz mais mirrors, e o download vai só pela origem;
  - downloads com credenciais (Creator Packs) não passam pelo aria2c, que reenviaria o `Authorization` num redirect para outro host;
  - o aria2c roda isolado da configuração do container (`--no-conf`, `--no-netrc`) e não segue metalink nem torrent baixados.
- **Retomada:**
  - uma falha do aria2c depois de baixar parte do arquivo mantém o parcial, e a próxima tentativa da fila continua dali, em vez de recomeçar do zero;
  - o motor nativo nunca retoma um parcial segmentado do aria2c (o arquivo poderia sair corrompido);
  - o cancelamento também apaga o `.tmp.aria2`.
- Uma sonda de mirror interrompida pelo usuário não conta mais como falha do mirror.
- **CI:** a tag `:latest` das imagens não era publicada, porque `${{ env.IMAGE_NS }}` estava dentro de uma string de outra expressão. Agora usa `format()`, e um teste impede expressões aninhadas.
- **Atualizador:** a tag de destino é validada no admin e no sidecar (`latest` ou versão) antes de entrar no `sed` que reescreve o `compose.yml` no host.
- `admin/.env.example`: a linha `CREATOR_PACKS_WORKER_BASE` estava colada ao comentário seguinte.

- **SSRF pelos mirrors:** os hosts dos mirrors do metalink são validados em três pontos (`host_safety.ts`):
  - no metalink: https, porta padrão, sem credenciais, hostname público;
  - no DNS: nenhum endereço não público, incluindo IPv4 embutido em NAT64 e 6to4, e Teredo;
  - a cada conexão, redirects incluídos. No motor nativo isso é feito por um `lookup` seguro; no aria2c, por um proxy `CONNECT` local de guarda (`connect_guard.ts`), que só abre túnel para a porta 443 de hosts públicos.

  A sonda do benchmark não segue redirect. Atrás de um proxy do ambiente, a checagem na conexão é desligada, para não quebrar a rede.
- **Limite do Wikimedia:** o aria2c não recebe mais a origem `download.kiwix.org` quando há mirrors explícitos, porque o redirect dela podia cair no `dumps.wikimedia.org` com várias conexões. Sozinha, a origem usa 1 conexão.
- **Variáveis `DOWNLOAD_*`:** um valor inválido impedia o app de iniciar (schema `enum`/`boolean`/`number`), e um booleano com erro de digitação desligava a função. Agora as variáveis são strings validadas pelo `preferencesFromEnv`, e um valor inválido volta ao padrão.
- **Retomada:** uma falha transitória do HEAD não descarta mais o parcial segmentado do aria2c.
- **Instalador a partir de releases:** o `install_nomad.sh` e o `run_updater_fixes.sh` baixam o compose e os scripts da **última release publicada** (ou de `NOMAD_RELEASE_TAG`), e não mais do `main`. O branch passa a ser uma opção explícita de desenvolvimento. Cada release anexa o instalador, o desinstalador e o compose, e o README instala por `releases/latest/download`.
- **CI:** todas as GitHub Actions foram fixadas por SHA de commit. O `release.yml` deixou de usar segredos, bot e serviços do projeto original (`COSMISTACKBOT_ACCESS_TOKEN`, `DEPLOYMENT_AUTHORIZED_USERS`, `NOMAD_API_KEY`). Agora só o dono do repositório pode lançar, com o `GITHUB_TOKEN` e permissões explícitas.
- **Apache-2.0 §4(b):** o `MODIFICATIONS.md` lista cada arquivo alterado, adicionado ou removido desde a base `f633b36`. Ele é gerado por `scripts/list-modifications.sh` e conferido por teste. O `THIRD_PARTY_NOTICES` declara isso, registra a licença do SVG do Commons que deu origem à logo (domínio público, PD-textlogo; a marca é da Canonical) e confirma que nada do NIHIL Shell foi copiado.
- `.gitignore`: as notas pessoais de sessão (`CLAUDE.md`, `ORIGINAL_PROMPT.md`, `SESSION_CONTEXT.md`) não entram mais no git.
- **Suíte de testes:** as 11 falhas que já existiam foram resolvidas.
  - Causas de ambiente: specs do Japa rodando no `node --test`; specs que exigem o app inicializado; falta de Redis e MySQL; addon nativo `@openzim/libzim` não compilado para o Node local.
  - Testes do upstream desatualizados: o stub sem `getModelInfo` (desde `27be71b`); a expectativa de 202 mensagens, de antes do `RagPipelineService`; e a asserção do `drug_labels`, que contradizia o próprio comentário.
  - Novos comandos: `npm run test:unit` (specs puros), `npm run test:app` (app inicializado) e `bash scripts/test-in-docker.sh`, que roda tudo no Node 22.23.5 com MySQL e Redis descartáveis.
  - O `content_auto_update_backoff` passou a usar o logger preguiçoso.
- **Prettier:** nenhum erro novo nas linhas alteradas pelo fork (os 31 foram corrigidos só nos trechos do fork; o estilo do código do upstream ficou como estava).

### Mantido por compatibilidade

- Os identificadores técnicos `/opt/project-nomad`, containers `nomad_*`, projeto compose `project-nomad`, imagens `project-nomad*` e cabeçalhos `X-NOMAD-*`. Renomeá-los quebraria a atualização de instalações existentes.
- Ubuntu continua sendo o sistema de referência e destino, com o mesmo instalador e o mesmo ambiente de execução.
