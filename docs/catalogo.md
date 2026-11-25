# Catálogo de conteúdos offline (Brasil)

O catálogo do monolith-nomad prioriza **pacotes ZIM que já existem em português**. Nada é traduzido: os arquivos são os publicados pelo Kiwix, sem alteração. Onde não existe um pacote em português adequado, o original em inglês continua no catálogo.

## Onde fica

| Arquivo | O que define |
|---|---|
| `collections/wikipedia.json` | Opções do seletor da Wikipédia. As opções em português (`pt-*`) vêm primeiro; as 5 em inglês mantêm os ids antigos (`top-mini`, `all-nopic` etc.), então seleções já salvas não mudam de significado. |
| `collections/kiwix-categories.json` | Categorias e níveis (Essencial, Padrão, Completo). Em cada categoria que tem conteúdo em português, o nível Essencial o inclui; o inglês complementa nos níveis seguintes. |

O app lê esses manifestos do branch `main` deste repositório no GitHub (`GITHUB_RAW_BASE_URL`). Uma mudança aqui só chega às instalações depois de publicada.

## Idioma de cada pacote

Cada recurso e cada opção da Wikipédia tem o campo `language`:

- `pt`: conteúdo em português;
- `en`: conteúdo em inglês (não há alternativa em português de cobertura adequada);
- `mul`: build multilíngue que inclui português (TED, Stack Overflow em Português, Low-tech Magazine).

A interface mostra esse campo como um selo (PT, EN, MULTI) na escolha de níveis, na revisão da instalação e no seletor da Wikipédia. O campo é opcional: versões do app anteriores a ele simplesmente o ignoram.

## Regras para mexer no catálogo

- **Só arquivos publicados no catálogo oficial do Kiwix** (`opds.library.kiwix.org`), servidos por `download.kiwix.org`. Builds da pasta `zim/community/` (de terceiros, sem curadoria) não entram.
- **SUBSTITUIR** um pacote em inglês só quando o equivalente em português tem cobertura comparável. Hoje isso vale para iFixit (105 mil artigos em pt contra 103 mil em en) e freeCodeCamp (996 contra 996).
- **COMPLEMENTAR** quando o pacote em português é bem menor (Wikipédia de Medicina, Wikibooks, Wikiversity): os dois ficam.
- O id do recurso precisa ser exatamente o nome do arquivo sem `_AAAA-MM.zim`, e o `version` o `AAAA-MM` do arquivo; é assim que o app reconhece o que está instalado.
- `size_mb` vem do tamanho publicado no metalink (`<url>.meta4`), não de estimativa.

## Verificação

- `admin/tests/unit/collections_catalog.spec.ts` (roda na suíte de unidade, sem rede): os manifestos passam nos validadores do app; cada recurso tem idioma coerente com o id; id e versão batem com a URL; nenhum nível repete arquivo; português vem primeiro; as opções em inglês da Wikipédia continuam com os ids antigos.
- `node scripts/check-catalog-availability.mjs` (com rede): para cada arquivo, pede o metalink oficial e confere se ele existe, se o tamanho bate com `size_mb`, se há SHA-256 publicado e se há pelo menos um mirror. Sai com código 1 se algo falhar. Rode-o antes de publicar mudanças no catálogo.

Na instalação, cada download é conferido contra o SHA-256 do metalink. Quando o Kiwix publica uma versão mais nova de um pacote, o app a encontra pelo catálogo OPDS. Quando um mirror falha, o próximo é usado (ver [`downloads.md`](downloads.md)).

## Biblioteca (PDF, EPUB e ZIM)

`collections/library.json` descreve a **Biblioteca** do app (página `/library`): obras em PDF, EPUB e ZIM organizadas por **área**, **assunto** e **nível** (iniciante, intermediário, avançado). Cada obra aparece uma vez e lista todas as áreas, assuntos e níveis que atende.

**Regras para incluir uma obra:**
- licença aberta **conferida dentro do próprio arquivo** (quando o arquivo e a página divergem, vale a mais restritiva, como no Vade Mecum e na Constituição do Senado: o repositório diz CC0, o PDF diz CC BY-NC-ND 4.0);
- URL do arquivo no **site oficial** do editor ou da instituição (nada é rehospedado, convertido ou modificado);
- `size_bytes` e `sha256` calculados na curadoria. Só a documentação do Python, que a PSF reconstrói continuamente, fica sem hash fixo (`sha256: null`); nela o app confere o formato do arquivo;
- obras em ZIM referenciam um `zim_id` de `kiwix-categories.json` e reaproveitam o download e o estado de instalação dos ZIMs.

**Como o app usa o manifesto:**
- o download passa pelo mesmo `RunDownloadJob` dos ZIMs (retomada, retry com backoff), com o SHA-256 fixado, e salva em `storage/library/<id>-<formato>_<versão>.<ext>`;
- antes de registrar a instalação, o job confere a assinatura do arquivo (`%PDF-`, ou ZIP com `mimetype` = `application/epub+zip`). Uma página de erro HTML servida com status 200, por exemplo, é recusada;
- uma divergência de hash ou de formato falha o download de vez, com a mensagem "Falha na verificação de integridade". A página oficial da obra continua no card como alternativa;
- o arquivo instalado entra na Base de Conhecimento (RAG), como os ZIMs, e é servido só se tiver linha de instalação (`GET /api/library/files/:filename`, sem acesso a outras pastas);
- leitura offline: PDF no visualizador do navegador, EPUB no leitor da página (epub.js, sem scripts do livro);
- a imagem traz uma cópia do `library.json`. Entre ela e a versão em cache, baixada do GitHub, vale a de `spec_version` mais nova (`app/utils/manifest_version.ts`). Assim uma instalação sem internet tem a Biblioteca desde o primeiro boot, e uma imagem construída antes do push não troca o próprio catálogo por um mais antigo. Uma versão mais nova publicada no GitHub continua valendo.

O Calibre-Web continua disponível no Depósito de Apps para quem quiser uma biblioteca própria. Os arquivos da Biblioteca ficam fora de `storage/books`, porque o Calibre-Web só exibe o que está registrado no `metadata.db` dele.

A verificação com rede (`node scripts/check-catalog-availability.mjs`) inclui os documentos: com `--hashes`, baixa cada um e compara com o SHA-256 fixado.

## Biblioteca de sobrevivência

Área `sobrevivencia` da Biblioteca: **25 publicações oficiais brasileiras em PDF (~138 MB)**, curadas em 24/11/2026. É a base principal do modo Sobrevivência do assistente local (ver [`assistente-local.md`](assistente-local.md)).

**Como entra uma obra:**
- metadados escritos à mão em `collections/curation/survival-library.json` (título, autoria, edição, áreas, assuntos, níveis, URL oficial, licença);
- `node scripts/build-library-entries.mjs` baixa o PDF da URL oficial, confere a assinatura `%PDF-`, procura a evidência da licença (`license_evidence`) no texto das 8 primeiras páginas, calcula tamanho e SHA-256 e grava as entradas em `library.json`. Sem a evidência no arquivo, a obra fica de fora;
- o vínculo com níveis, ameaças, fases, temas e regiões fica em `collections/survival.json` (campo `works`), que também liga 19 ZIMs já existentes no catálogo (água, alimentos, medicina, pós-desastre, Ready.gov, Appropedia, rádio amador e outros).

**Obras por editor:**

| Editor | Obras | Licença impressa no arquivo |
|---|---|---|
| Ministério da Saúde | 17: água em casa e qualidade da água, inundações (guia, abrigos, UBS), planos de contingência (chuvas intensas, seca e estiagem, barragens), queimadas, violências em emergências climáticas, animais peçonhentos, protocolos de acidentes ofídicos e escorpiônicos, Guia de Vigilância em Saúde (3 volumes), alimentos regionais | CC BY-NC-SA 4.0 |
| Ministério do Desenvolvimento Regional (SEDEC) | 2: caderno de gestão integrada de riscos (GIRD+10), guia de alertas do Governo Federal | CC BY-NC-SA 4.0; reprodução de dados com citação da fonte |
| Ministério do Meio Ambiente e Mudança do Clima | 6: "Comunidades preparadas" (guia de diálogos e cadernos de inundações, deslizamentos, secas, incêndios, ondas de calor) | reprodução sem fins lucrativos com citação |

**Níveis da Configuração Rápida** (cumulativos): **Essencial** (9 obras curtas para o público: cadernos do MMA, água em casa, animais peçonhentos, queimadas), **Padrão** (+11: planos de contingência, inundações, alertas, GIRD, alimentos regionais), **Completo** (+5: protocolos clínicos e Guia de Vigilância). O padrão é Completo.

**gov.br:** os servidores respondem 403 a `HEAD`. A sonda de download tenta um `GET` de 1 byte quando o `HEAD` é recusado; sem isso os 22 PDFs do gov.br falhariam.

**Avaliadas e deixadas de fora (24/11/2026):** Embrapa (agricultura, hortas, semiárido: "Todos os direitos reservados" no arquivo); OPAS (primeiros cuidados psicológicos), CICV, manuais da Defesa Civil de 1999, suporte básico de vida do SAMU e materiais da Fiocruz (sem licença de reprodução no arquivo).

## O que não existe em português (pendências)

Até 21/11/2026 não foi encontrado nenhum ZIM pronto, no Kiwix ou em outra fonte confiável, para: legislação brasileira, SUS e saúde pública, ENEM e vestibulares, Embrapa e agricultura brasileira, IBGE e dados nacionais, Defesa Civil (equivalente ao Ready.gov), bulário da Anvisa (equivalente ao openFDA). Para esses conteúdos o caminho seria pedir uma receita ao Kiwix (repositório `openzim/zim-requests`), não montar arquivos aqui.

Sobrevivência (24/11/2026): faltam em português, com licença no arquivo, agricultura e produção de alimentos (Embrapa), primeiros socorros para leigos, primeiros cuidados psicológicos e orientação e navegação. Para essas áreas o agente usa os ZIMs em inglês (busca com termos em inglês) e diz quando a fonte não é brasileira.

Mapas: o Brasil já é coberto pela extração por país (Protomaps, em Configurações → Mapas). A coleção pronta `maps.json` continua só com os estados dos EUA.
