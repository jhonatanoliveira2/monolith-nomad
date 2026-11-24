# Notas de Versão

Problemas e sugestões: [GitHub Issues](https://github.com/jhonatanoliveira2/monolith-nomad/issues).

## Versão 1.2.0 · 24/11/2026

### Interface
- **Redesign Nothing:** navegação única por grupos (Conhecimento, Conteúdo, Apps, Sistema, Ajuda), paleta de comandos (**Ctrl K**), Início com estado do sistema e downloads, e tela **[Downloads](/downloads)** com tudo o que está na fila.
- **Logo do Ubuntu em pontos**, com o laranja do Ubuntu como cor de destaque.
- **Biblioteca:** filtros por área, assunto, nível, formato, idioma e disponibilidade; detalhes num painel lateral; leitor de PDF integrado (busca, sumário, zoom, páginas escuras) e leitor de EPUB com busca e temas.

### Configuração Rápida
- Quatro etapas (**Recursos, Mapas, Conteúdo, Revisão**) com resumo lateral, tamanho total e espaço livre depois da instalação.
- **Brasil por padrão:** pt-BR, fuso America/Sao_Paulo, estado e fuso selecionáveis (os quatro fusos brasileiros), formatos brasileiros.
- **Mapas do Brasil:** país inteiro, regiões ou estados (27 UFs), com tamanho medido na fonte.
- **Perfis Essencial, Padrão e Completo** por área, ou seleção personalizada. Conteúdo em português por padrão; inglês opcional por área ou por item.
- Escolhas salvas no servidor; itens já instalados ou em download não são baixados de novo.

### Instalador
- Fuso America/Sao_Paulo quando o host está em UTC, `NOMAD_TZ` para escolher outro, e geração do locale pt_BR.UTF-8.

### Documentação
- Documentação do app reescrita, mais curta e de acordo com a interface nova.

## Versão 1.1.0 · 21/11/2026

- **Catálogo em português:** a Wikipédia em português virou o padrão; ZIMs em português ou multilíngues vêm primeiro em cada área, e cada pacote mostra o idioma.
- **Biblioteca:** 37 obras abertas (PDF, EPUB e ZIM) por área, assunto e nível, com SHA-256 fixado e leitor offline.
- **GPU AMD:** o modelo e a VRAM reais aparecem no Sistema (antes, "Device 7590" com 512 MB).

## Versão 1.0.0 · 20/11/2026

- **Downloads inteligentes:** mirrors oficiais do Kiwix medidos antes de baixar, aria2c com retomada e SHA-256 conferido antes de instalar.
- **Distribuição própria:** instalador, imagens, atualizações e catálogos vêm deste repositório; serviços online de terceiros desligados por padrão.
- **Tema Nothing** e **pt-BR** como idioma padrão.
