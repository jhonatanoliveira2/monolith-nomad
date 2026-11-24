# Primeiros passos

## Requisitos

| | Mínimo (sem IA) | Recomendado (com IA local) |
|---|---|---|
| **Sistema** | Ubuntu 24.04 LTS ou Debian 12 | **Ubuntu 26.04 LTS** |
| **CPU** | 2 núcleos, 2 GHz | Ryzen 7 / Core i7 ou superior |
| **RAM** | 4 GB | 32 GB |
| **Disco** | 10 GB + conteúdo | 250 GB ou mais, SSD |
| **GPU** | — | NVIDIA RTX 3060 ou AMD equivalente |

Ubuntu Desktop ou Server: tudo é acessado pelo navegador. Windows (WSL2) tem só suporte da comunidade; macOS, Fedora e Arch não são suportados.

## Instalação

```bash
sudo apt-get install -y curl && \
curl -fsSL https://github.com/jhonatanoliveira2/monolith-nomad/releases/latest/download/install_nomad.sh \
  -o install_nomad.sh && \
sudo bash install_nomad.sh
```

O instalador configura o Docker, o NVIDIA Container Toolkit (com GPU NVIDIA), o fuso do servidor (America/Sao_Paulo quando o host está em UTC) e o locale pt_BR.UTF-8. **O driver da GPU precisa estar no host antes**: no Ubuntu, marque "Instalar software de terceiros" na instalação do sistema. Para escolher outro fuso: `sudo NOMAD_TZ=America/Manaus bash install_nomad.sh`.

## Configuração Rápida

**[Abrir a Configuração Rápida →](/easy-setup)**

![Configuração Rápida, etapa 1: recursos](/docs/easy-setup-step1.webp)

| Etapa | O que você escolhe |
|---|---|
| **1. Recursos** | Biblioteca de Informação, Plataforma de Educação, Assistente de IA; estado e fuso horário |
| **2. Mapas** | Brasil inteiro (padrão), regiões ou estados, e o nível de detalhe |
| **3. Conteúdo** | Perfil por área: **Essencial**, **Padrão**, **Completo** ou personalizado |
| **4. Revisão** | Tudo o que será baixado, o tamanho total e o espaço que sobra no disco |

![Perfis de conteúdo](/docs/easy-setup-tiers.webp)

- Os tamanhos vêm dos manifestos do catálogo; o do mapa é medido na fonte para a seleção exata.
- Conteúdo em português entra por padrão. Itens em inglês ficam desligados e podem ser ativados por área ou um a um.
- O que já está instalado ou baixando é ignorado; nada é baixado duas vezes.
- As escolhas ficam salvas: você pode sair e voltar.
- Nada é baixado antes de **Iniciar instalação**. Acompanhe, cancele ou repita em **[Downloads](/downloads)**.

## Ferramentas

| Ferramenta | Para quê | Onde |
|---|---|---|
| **Biblioteca** | Livros e manuais em PDF, EPUB e ZIM, com leitor integrado (busca, sumário, tema escuro, última página) | [Biblioteca](/library) |
| **Biblioteca de Informação** (Kiwix) | Wikipédia, referências médicas, guias práticos | Início ou [Depósito de Apps](/supply-depot) |
| **Plataforma de Educação** (Kolibri) | Cursos com vídeos, exercícios e progresso por aluno | Início ou [Depósito de Apps](/supply-depot) |
| **Assistente de IA** (Ollama) | Chat local; nada sai do servidor | [Assistente](/chat) |
| **Base de Conhecimento** | A IA responde com base nos seus PDFs e textos | [Base de Conhecimento](/chat?knowledge_base=true) |
| **Mapas** | Mapas offline com busca | [Mapas](/maps) · [Gerenciador](/settings/maps) |
| **Benchmark** | Pontuação de CPU, memória, disco e IA | [Benchmark](/settings/benchmark) |

![Assistente de IA](/docs/ai-chat.webp)

**GPU:** sem GPU a IA roda na CPU, bem mais devagar. Se instalar uma GPU depois, use **Forçar reinstalação** no Assistente de IA, no [Depósito de Apps](/supply-depot).

![Base de Conhecimento](/docs/knowledge-base.webp)

![Mapas](/docs/maps.webp)

## Mais conteúdo

- **ZIMs e Wikipédia:** [Explorador de Conteúdo](/settings/zim/remote-explorer). Só uma edição da Wikipédia fica ativa por vez.
- **Mapas de outros países:** [Gerenciador de Mapas](/settings/maps).
- **Cursos:** pelo próprio Kolibri (Device → Channels).

![Explorador de Conteúdo](/docs/content-explorer.webp)

![Benchmark](/docs/benchmark.webp)

## Antes de ficar offline

1. Rode as [atualizações](/settings/update) de software e conteúdo.
2. Baixe mapas, referências e cursos de que vai precisar.
3. Teste cada recurso enquanto ainda há internet.

Dúvidas: [Perguntas Frequentes](/docs/faq) · [Problemas e sugestões](https://github.com/jhonatanoliveira2/monolith-nomad/issues)
