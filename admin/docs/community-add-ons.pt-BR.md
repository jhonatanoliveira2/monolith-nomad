# Complementos da Comunidade

O monolith-nomad vem com um conjunto selecionado de ferramentas e conteúdos integrados, mas a comunidade do projeto original começou a criar complementos que ampliam a plataforma com pacotes de conteúdo offline especializados. São projetos de terceiros, não mantidos pelo monolith-nomad. Instale-os por sua conta e risco, e envie bugs ou pedidos de recursos para o repositório de cada complemento.

Criou um complemento? Abra uma issue no [repositório do monolith-nomad](https://github.com/jhonatanoliveira2/monolith-nomad/issues/new) para que ele seja avaliado para inclusão nesta página.

---

## Pacotes de conteúdo ZIM

Os pacotes de conteúdo ZIM acrescentam material de referência offline à sua biblioteca Kiwix existente. Normalmente eles trazem um script `install.sh` que baixa o material de origem, gera um arquivo ZIM com o `zimwriterfs` e o registra no container do Kiwix em execução.

### Manuais de campo militares dos EUA

**Repositório:** [github.com/jrsphoto/ZIM-military-field-manuals](https://github.com/jrsphoto/ZIM-military-field-manuals)

Cerca de 180 manuais de campo militares dos EUA, em domínio público e em inglês, sobre medicina de campo, sobrevivência, primeiros socorros em combate, leitura de mapas e mais. Eles são reunidos num ZIM pesquisável que entra direto na sua biblioteca Kiwix.

O ZIM final tem cerca de 2 GB. Durante a geração, o script baixa cerca de 2 GB de PDFs de origem do archive.org.

### Arquivo de programação W3Schools

**Repositório:** [github.com/kennethbrewer3/ZIM-w3schools-offline](https://github.com/kennethbrewer3/ZIM-w3schools-offline)

Uma cópia offline completa dos tutoriais de programação do W3Schools, em inglês, cobrindo HTML, CSS, JavaScript, Python, SQL e mais. Bom para aprender a programar, consultar sintaxe ou ensinar programação num ambiente sem internet.

O ZIM final tem cerca de 700 MB. Durante a geração, o script baixa cerca de 6 GB de arquivos de origem de um mirror no GitHub.

---

## Como instalar um complemento da comunidade

Cada complemento tem as próprias instruções de instalação, mas a maioria dos pacotes ZIM segue o mesmo formato:

1. Clone o repositório do complemento no host do monolith-nomad, via SSH.
2. Veja no README as dependências necessárias para a geração. A maioria precisa de `git`, `python3`, `unzip` e `zim-tools`.
3. Rode o `install.sh` incluído com a opção `--deploy`, indicando o caminho da biblioteca Kiwix (`/opt/project-nomad/storage/zim`) e o nome do container do Kiwix (`nomad_kiwix_server`).
4. O script gera o ZIM, copia para a sua biblioteca Kiwix, registra no Kiwix e reinicia o container do Kiwix.

Quando o script terminar, o conteúdo novo aparece na Biblioteca de Informação na próxima vez que você abri-la.

A primeira geração pode levar de alguns minutos a uma hora ou mais, dependendo do tamanho do complemento e da CPU do host.

---

## Sobre o suporte

Estes complementos são criados e mantidos pela comunidade. Se algo der errado com um script de instalação ou com o conteúdo de um ZIM, abra uma issue no repositório do próprio complemento, não no do monolith-nomad. Se o problema for do monolith-nomad em si, por exemplo, se o Kiwix não reconhecer um ZIM novo depois da instalação, abra uma issue nas [GitHub Issues do monolith-nomad](https://github.com/jhonatanoliveira2/monolith-nomad/issues). Conteúdo de terceiros, porém, não tem manutenção nem suporte por aqui.
