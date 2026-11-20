# Sobre o monolith-nomad

O **monolith-nomad** é uma distribuição independente derivada do **Project N.O.M.A.D.**, projeto criado em 2025 por Chris Sherwood, da [Crosstalk Solutions, LLC](https://crosstalksolutions.com). O objetivo do projeto original não é criar só mais um utilitário para guardar recursos offline, e sim permitir que cada pessoa rode o seu próprio "computador de sobrevivência" definitivo. O nome começou como um acrônimo, Node for Offline Maps, Archives, and Data (nó para mapas, arquivos e dados offline).

O monolith-nomad não é oficial nem afiliado ao Project N.O.M.A.D. ou à Crosstalk Solutions, LLC, e não é endossado por eles.

## O que esta distribuição muda

- **Português do Brasil como idioma padrão**, na interface e nesta documentação.
- **Identidade visual Nothing:** tema escuro (OLED) monocromático, textura de pontos e as fontes Doto, Space Grotesk e Space Mono.
- **Downloads inteligentes:** para conteúdo do Kiwix, o servidor lê a lista oficial de mirrors (metalink), mede os mirrors antes de escolher, baixa com o aria2c e confere o SHA-256 antes de instalar qualquer arquivo.
- **Distribuição e atualizações próprias:** o instalador, as imagens, as atualizações e os catálogos vêm do repositório deste fork. Os serviços online do projeto original (leaderboard de benchmark, newsletter, lista curada de modelos) ficam desligados por padrão.

## Hardware

Muitos computadores de sobrevivência offline parecidos são feitos para rodar em hardware mínimo e leve. O monolith-nomad, como o projeto original, vai na direção oposta. Para instalar e rodar as ferramentas de IA disponíveis, recomendamos fortemente um equipamento robusto, com GPU, para aproveitar ao máximo a instalação. Os requisitos estão no [Guia de Primeiros Passos](/docs/getting-started).

Desde a primeira versão, o projeto ganhou um chat de IA integrado com Base de Conhecimento para respostas baseadas nos seus documentos, um Benchmark do Sistema, coleções de conteúdo selecionadas em níveis e um assistente de Configuração Rápida para quem está começando.

## Licença

O monolith-nomad é código aberto, distribuído sob a [Apache License 2.0](https://github.com/jhonatanoliveira2/monolith-nomad/blob/main/LICENSE), a mesma do projeto original. Os créditos, as licenças e os avisos de marca de terceiros estão no arquivo `THIRD_PARTY_NOTICES.md` do repositório.

## Links

- **Repositório:** [jhonatanoliveira2/monolith-nomad](https://github.com/jhonatanoliveira2/monolith-nomad)
- **Problemas e sugestões:** [GitHub Issues](https://github.com/jhonatanoliveira2/monolith-nomad/issues)
- **Projeto original:** [Crosstalk-Solutions/project-nomad](https://github.com/Crosstalk-Solutions/project-nomad)
