# Complementos da comunidade

Pacotes ZIM de terceiros que ampliam a Biblioteca de Informação. Não são mantidos por este projeto: bugs e pedidos vão para o repositório de cada um. Para sugerir um complemento, [abra uma issue](https://github.com/jhonatanoliveira2/monolith-nomad/issues/new).

| Complemento | Conteúdo | ZIM final | Baixa na geração |
|---|---|---|---|
| [Manuais de campo militares dos EUA](https://github.com/jrsphoto/ZIM-military-field-manuals) | ~180 manuais em inglês (medicina de campo, sobrevivência, leitura de mapas) | ~2 GB | ~2 GB do archive.org |
| [W3Schools offline](https://github.com/kennethbrewer3/ZIM-w3schools-offline) | Tutoriais de HTML, CSS, JavaScript, Python, SQL, em inglês | ~700 MB | ~6 GB |

## Instalação

1. Clone o repositório do complemento no servidor (SSH).
2. Instale as dependências do README (em geral `git`, `python3`, `unzip`, `zim-tools`).
3. Rode `install.sh --deploy` com a pasta da biblioteca (`/opt/project-nomad/storage/zim`) e o container do Kiwix (`nomad_kiwix_server`).
4. O script gera o ZIM, registra no Kiwix e reinicia o container.

A geração pode levar de minutos a mais de uma hora. Se o Kiwix não reconhecer o ZIM, [abra uma issue aqui](https://github.com/jhonatanoliveira2/monolith-nomad/issues).
