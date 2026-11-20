# monolith-nomad

**Servidor offline de conhecimento e educação**, com ferramentas, conteúdo e IA locais, que funciona sem internet depois de instalado.

O monolith-nomad é uma **distribuição independente e não oficial** derivada do [Project N.O.M.A.D.](https://github.com/Crosstalk-Solutions/project-nomad) (Crosstalk Solutions, LLC, Apache-2.0). Não é afiliado ao projeto original nem endossado por ele. Créditos, licenças e marcas de terceiros estão em [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

---

## O que é

O monolith-nomad é uma interface de gerenciamento (a **Central de Comando**) com uma API que orquestra, via [Docker](https://www.docker.com/), um conjunto de ferramentas e conteúdos em containers. Ele cuida da instalação, da configuração e das atualizações de tudo, para que você não precise fazer isso à mão.

Tudo é acessado pelo navegador. Não é preciso ambiente gráfico no servidor: você pode instalá-lo como "servidor" e usá-lo a partir de outros dispositivos da rede local.

## Recursos

**Recursos herdados do projeto original:**

- **Chat de IA com Base de Conhecimento**: IA local com [Ollama](https://ollama.com/), ou com software compatível com a API da OpenAI (LM Studio, llama.cpp), com upload de documentos e busca semântica (RAG com [Qdrant](https://qdrant.tech/)).
- **Biblioteca de Informação**: Wikipédia offline, referências médicas, e-books e mais, via [Kiwix](https://kiwix.org/).
- **Plataforma de Educação**: cursos da Khan Academy com acompanhamento de progresso, via [Kolibri](https://learningequality.org/kolibri/).
- **Mapas offline**: mapas regionais para download, via [Protomaps](https://protomaps.com).
- **Ferramentas de dados**: criptografia, codificação e análise, via [CyberChef](https://gchq.github.io/CyberChef/).
- **Notas**: anotações locais, via [FlatNotes](https://github.com/dullage/flatnotes).
- **Benchmark do sistema**: pontuação do hardware e Etiquetas de Montador.
- **Depósito de Apps**: catálogo de apps com instalação em um clique (ferramentas de PDF, navegador de arquivos, biblioteca de e-books, gerenciador de senhas e outros), além da opção de rodar seus próprios containers Docker.
- **Atualizações automáticas**: opcionais, para o software principal, os apps instalados e o conteúdo offline, na janela de horário que você definir.
- **Configuração Rápida**: assistente de primeira configuração com coleções de conteúdo selecionadas.
- Ferramentas embutidas como seletor de conteúdo da Wikipédia, gerenciador da biblioteca ZIM e Explorador de Conteúdo.

| Recurso | Base | O que você recebe |
|---|---|---|
| Biblioteca de Informação | Kiwix | Wikipédia offline, referências médicas, guias de sobrevivência, e-books |
| Assistente de IA | Ollama + Qdrant | Chat com upload de documentos e busca semântica |
| Plataforma de Educação | Kolibri | Cursos da Khan Academy, progresso, vários usuários |
| Mapas offline | Protomaps | Mapas regionais para ver e pesquisar offline |
| Ferramentas de dados | CyberChef | Criptografia, codificação, hashes e análise de dados |
| Notas | FlatNotes | Anotações locais com suporte a Markdown |
| Benchmark do sistema | Embutido | Pontuação do hardware e Etiquetas de Montador |
| Depósito de Apps | Embutido | Catálogo de apps em um clique e containers Docker próprios |

**O que este fork acrescenta:**

- **Downloads inteligentes**: metalink do Kiwix com mirrors oficiais, benchmark de mirrors (a medição decide, a distância só desempata), aria2c com download segmentado, retomada, retry com backoff exponencial, fallback automático e verificação SHA-256 antes de instalar. Detalhes em [`docs/downloads.md`](docs/downloads.md).
- **Tema Nothing**: interface escura por padrão, monocromática, com textura de pontos e fontes locais (Doto, Space Grotesk, Space Mono).
- **Português brasileiro**: interface, instalador e documentação em pt-BR, com datas e números no formato brasileiro. A estrutura de tradução permite novos idiomas ([`admin/inertia/locales/README.md`](admin/inertia/locales/README.md)).
- **AMD/ROCm**: o instalador detecta GPUs AMD e o modelo (gfx) da placa, e o Assistente de IA usa aceleração ROCm sem depender de NVIDIA/CUDA. GPUs NVIDIA continuam com suporte.
- **Independência**: instalador, imagens, atualizações e catálogos apontam para este repositório, e os serviços online do projeto original ficam desligados por padrão ([`docs/distribuicao.md`](docs/distribuicao.md)).

## Requisitos

O sistema de referência é o **Ubuntu 24.04 LTS ou 26.04 LTS**. O instalador funciona em sistemas baseados em Debian (Debian 12 também é suportado) e só em **x86_64**. A instalação é toda pelo terminal e precisa de `sudo`.

O monolith-nomad em si é leve: precisa de cerca de **5 GB de disco e menos de 1 GB de RAM**. Quem enche o disco é o conteúdo offline que você adiciona depois, e quem aumenta a necessidade de memória é o Assistente de IA.

*O monolith-nomad não é patrocinado por nenhum fabricante de hardware e foi feito para ser o mais independente de hardware possível. Os componentes abaixo servem só como exemplo e comparação.*

#### Requisitos mínimos

- Processador: dual-core de 2 GHz ou melhor
- RAM: 4 GB (a stack inteira, sem IA, roda com menos de 1 GB)
- Armazenamento: pelo menos 5 GB livres (reserve 10 GB para instalar com folga)
- Sistema: baseado em Debian (Ubuntu 24.04 ou 26.04 LTS recomendado)
- Conexão estável com a internet (só durante a instalação)

Com o Assistente de IA, a instalação passa para cerca de **25 GB**, porque o Ollama e um modelo de uso geral são grandes, e o modelo precisa de mais ou menos o tamanho do download em memória enquanto responde. Essa memória vem da VRAM, se você tem GPU dedicada, ou da RAM do sistema, se não tem. É por isso que os números abaixo são bem maiores.

#### Requisitos ideais (para IA)

- Processador: AMD Ryzen 7, Intel Core i7 ou melhor
- RAM: 32 GB
- Placa de vídeo: AMD Radeon com suporte a ROCm ou NVIDIA RTX 3060 ou equivalente, ou melhor (mais VRAM permite modelos maiores)
- Armazenamento: pelo menos 250 GB livres (de preferência SSD/NVMe)
- Sistema: baseado em Debian (Ubuntu 24.04 ou 26.04 LTS recomendado)
- Conexão estável com a internet (só durante a instalação)

O que define os requisitos da sua instalação são as ferramentas e os conteúdos que você escolhe instalar.

#### IA em outro computador

Por padrão, o Ollama é instalado no próprio host quando você instala o Assistente de IA. Para rodar o modelo em outra máquina, abra as configurações do Assistente de IA e informe a URL de um servidor Ollama ou compatível com a API da OpenAI (como o LM Studio).

- Se usar o Ollama em outro host, inicie o servidor com `OLLAMA_HOST=0.0.0.0`.
- O Ollama é o caminho preferido, porque permite baixar modelos pela interface, o que a API da OpenAI não oferece. Com o LM Studio, por exemplo, os modelos precisam ser baixados pelo próprio LM Studio.
- A configuração do servidor no outro host é responsabilidade sua.

## Instalação

> **Antes da primeira instalação:** o mantenedor precisa publicar as imagens do fork no ghcr (`ghcr.io/jhonatanoliveira2/project-nomad`, `…-sidecar-updater`, `…-disk-collector` e `…-translate`) e torná-las **públicas**. Sem isso, o `docker compose pull` falha. O passo a passo está em [`docs/distribuicao.md`](docs/distribuicao.md#antes-da-primeira-instalação-publicar-as-imagens).

### Instalação rápida (só em sistemas baseados em Debian)

```bash
sudo apt-get update && \
sudo apt-get install -y curl && \
curl -fsSL https://github.com/jhonatanoliveira2/monolith-nomad/releases/latest/download/install_nomad.sh \
  -o install_nomad.sh && \
sudo bash install_nomad.sh
```

O instalador pede confirmação e o aceite da licença (responda `s` ou `y`), verifica o host (propagação de montagem e portas livres), instala o Docker se faltar, configura GPU NVIDIA quando houver e sobe os containers. Ao terminar, abra `http://localhost:8080` (ou `http://IP_DO_DISPOSITIVO:8080`) no navegador.

O instalador e tudo o que ele baixa (compose e scripts) vêm da **última release publicada** do monolith-nomad, os mesmos arquivos que geraram as imagens daquela versão. Para fixar uma versão, instalar de outro fork ou, em desenvolvimento, de um branch:

```bash
NOMAD_RELEASE_TAG=v1.36.0 sudo -E bash install_nomad.sh          # uma release específica
NOMAD_GITHUB_REPO=dono/repo sudo -E bash install_nomad.sh         # a última release de outro fork
NOMAD_GITHUB_BRANCH=main sudo -E bash install_nomad.sh            # um branch (desenvolvimento, não produção)
```

Sem nenhuma release publicada, o instalador para com uma mensagem, em vez de cair silenciosamente no `main`.

**Rodar o instalador de novo não é atualização:** ele recria as credenciais e zera o banco de dados. Para atualizar, veja [Atualização](#atualização).

### Instalação avançada

Para ter mais controle, copie o [modelo do Docker Compose](https://github.com/jhonatanoliveira2/monolith-nomad/releases/latest/download/management_compose.yaml) (o da última release) para um arquivo `docker-compose.yml` e ajuste como quiser (substitua todos os valores `replaceme` pelos reais). Depois, rode `docker compose up -d` para iniciar a Central de Comando e as dependências. Esse método é só para quem já conhece Docker, porque exige configuração manual antes de iniciar.

### Portas e caminhos

| Item | Valor |
|---|---|
| Central de Comando | porta `8080` |
| Logs dos containers (Dozzle) | porta `9999` |
| Diretório da instalação | `/opt/project-nomad` |
| Compose de gerenciamento | `/opt/project-nomad/compose.yml` (projeto compose `project-nomad`) |
| Dados e conteúdo | `/opt/project-nomad/storage` |
| Containers | prefixo `nomad_` (por exemplo `nomad_admin`, `nomad_ollama`) |

Os nomes técnicos (`/opt/project-nomad`, `nomad_*`, `project-nomad*`) foram mantidos de propósito, por compatibilidade de instalação e atualização.

## Scripts auxiliares

Depois da instalação, alguns scripts ajudam na manutenção e na solução de problemas que não dá para resolver pela Central de Comando. Todos ficam em `/opt/project-nomad`.

**Iniciar** todos os containers instalados:

```bash
sudo bash /opt/project-nomad/start_nomad.sh
```

**Parar** todos os containers instalados:

```bash
sudo bash /opt/project-nomad/stop_nomad.sh
```

## Atualização

A Central de Comando se atualiza pela interface (**Configurações → Verificar Atualizações**). As atualizações automáticas, quando ativadas, instalam só versões *minor* e *patch*, dentro da janela configurada, depois de um período de espera e só quando as checagens prévias passam (disco suficiente para a nova imagem, nenhum download ou instalação de app em andamento). Versões *major* sempre exigem atualização manual.

O script de atualização baixa as imagens mais recentes da Central de Comando e das dependências dela (MySQL, Redis etc.) e recria os containers. Ele **só** atualiza os containers da Central de Comando. Os apps instaláveis são atualizados pela interface.

```bash
sudo bash /opt/project-nomad/update_nomad.sh
```

### Testar as atualizações automáticas (simulação)

Como testar essa lógica com versões reais não é prático, um comando Ace executa **todo o processo de decisão sem nunca disparar uma atualização**. Rode a partir do diretório `admin/`:

```bash
# 1) Cenários determinísticos: sem rede, banco ou Docker.
#    Cobre todos os casos (só major, período de espera, prerelease/draft, janela que vira o dia…)
#    e sai com código diferente de zero se algo falhar, então pode rodar no CI.
node ace auto-update:dry-run --scenarios

# 2) Simula "o que aconteceria se eu estivesse na 1.32.0 agora?"
#    contra a lista REAL de releases no GitHub e as checagens prévias reais:
node ace auto-update:dry-run --current=1.32.0 --force-enabled

# 3) Simulação totalmente offline, com lista de releases fixa e relógio fixo:
node ace auto-update:dry-run --current=1.32.0 --force-enabled \
  --releases-file=./fixtures/releases.json --now=2026-06-04T21:00:00Z \
  --window-start=20:00 --window-end=23:00 --cooloff=72 --skip-preflight
```

A saída mostra a decisão: versão atual, se o relógio está dentro da janela, a versão elegível (se houver) e os bloqueios das checagens prévias. Termina com um veredito como `WOULD UPDATE → v1.33.2` ou `WOULD NOT UPDATE (outside-window): …`. **Nenhuma atualização real é pedida.**

| Opção | Descrição |
|---|---|
| `--scenarios` | Roda os cenários determinísticos embutidos e sai |
| `--current=<versão>` | Simula a versão em execução (por exemplo `1.32.0`) |
| `--force-enabled` | Trata a atualização automática como ativada, ignorando a configuração salva |
| `--cooloff=<horas>` | Substitui o período de espera |
| `--window-start=<HH:MM>` / `--window-end=<HH:MM>` | Substitui a janela de atualização |
| `--now=<data ISO>` | Simula o relógio num horário específico |
| `--releases-file=<caminho>` | Usa um arquivo JSON local de releases em vez de consultar o GitHub (offline) |
| `--skip-preflight` | Pula as checagens prévias de Docker, disco e filas |

## Desinstalação

Quer começar do zero? O script de desinstalação remove os containers, a rede e o volume compartilhado, e pergunta se deve excluir `/opt/project-nomad` com todos os dados. **Isso não pode ser desfeito.**

```bash
curl -fsSL https://github.com/jhonatanoliveira2/monolith-nomad/releases/latest/download/uninstall_nomad.sh -o uninstall_nomad.sh && sudo bash uninstall_nomad.sh
```

## Internet e privacidade

O monolith-nomad foi feito para uso offline. A internet só é necessária na instalação (para baixar as dependências) e quando você decide baixar ferramentas e conteúdos depois. Fora isso, ele não precisa de conexão e **não tem nenhuma telemetria embutida**.

Os serviços online do projeto original (leaderboard de benchmark, newsletter, lista curada de modelos de IA) ficam **desligados por padrão** e só são usados se você os religar por variável de ambiente ([`docs/distribuicao.md`](docs/distribuicao.md#serviços-online-do-projeto-original-desligados-por-padrão)).

Para testar a conexão, a Central de Comando consulta primeiro `https://1.1.1.1/cdn-cgi/trace`, da Cloudflare. Se não responder (por exemplo, se a sua rede bloqueia o `1.1.1.1`), tenta a API do GitHub, que o app já usa, e considera a conexão ativa se alguma responder.

Você pode trocar a URL desse teste em **Configurações → Avançado** (salvo localmente na sua instância) ou pela variável de ambiente `INTERNET_STATUS_TEST_URL`. A variável de ambiente sempre tem prioridade sobre o valor da interface. Sem nenhuma das duas, valem os padrões acima.

## Segurança

Por projeto, o monolith-nomad é aberto e sem barreiras: **não tem autenticação**. Se você ligar o dispositivo a uma rede local depois da instalação (para outros dispositivos acessarem os recursos), controle o acesso bloqueando ou liberando portas.

Uma camada opcional de autenticação, com perfis diferentes (uso familiar com controle parental, sala de aula com contas de professor), pode vir no futuro, mas não é prioridade. Até lá, use controles de rede para limitar o acesso. **Não exponha o monolith-nomad diretamente à internet**, a menos que você saiba exatamente o que está fazendo, tenha tomado as medidas de segurança adequadas e entenda os riscos.

Para reportar uma vulnerabilidade, veja [`SECURITY.md`](SECURITY.md).

## Documentação

- [`docs/downloads.md`](docs/downloads.md): downloads inteligentes (mirrors, benchmark, aria2c, SHA-256, fallback) e as medições.
- [`docs/distribuicao.md`](docs/distribuicao.md): independência do fork, publicação das imagens e variáveis.
- [`admin/docs/`](admin/docs/): documentação exibida na Central de Comando ([primeiros passos](admin/docs/getting-started.md), [FAQ](admin/docs/faq.md), [Depósito de Apps](admin/docs/supply-depot-apps.md), [atualizações](admin/docs/updates.md), [referência da API](admin/docs/api-reference.md), [complementos da comunidade](admin/docs/community-add-ons.md), [notas de versão](admin/docs/release-notes.md)).
- [`FAQ.md`](FAQ.md): perguntas frequentes.
- [`admin/inertia/locales/README.md`](admin/inertia/locales/README.md): convenções de tradução e glossário pt-BR.

## Contribuir

Contribuições são bem-vindas. Leia o [`CONTRIBUTING.md`](CONTRIBUTING.md) e o [Código de Conduta](CODE_OF_CONDUCT.md). Bugs e sugestões vão em <https://github.com/jhonatanoliveira2/monolith-nomad/issues>.

## Créditos e licença

O monolith-nomad é derivado do **Project N.O.M.A.D.**, Copyright 2024-2026 Crosstalk Solutions, LLC, e é distribuído sob a mesma licença, a [Apache License 2.0](LICENSE). O arquivo `LICENSE` é mantido sem alterações. As modificações deste fork estão registradas no histórico do git e descritas em [`docs/`](docs/).

Os créditos completos, as licenças das fontes, do software incluído e do conteúdo instalável, e os avisos de marca (Ubuntu/Canonical, Nothing) estão em [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
