# Assistente local (IA offline)

Agente de IA que roda inteiro no computador do usuário: chat geral, ajuda nos leitores de PDF e EPUB, tradução sob demanda, busca na biblioteca (RAG sobre ZIM, PDF e EPUB) e um modo **Sobrevivência** regionalizado para o Brasil. A internet só é usada para baixar modelos e conteúdo; depois disso, inferência, embeddings, busca e tradução usam apenas componentes locais.

## Componentes

| Parte | Onde | O que faz |
|---|---|---|
| Inferência e embeddings | Ollama (container `nomad_ollama`, 0.40.18) | Chat, resumo, explicação, tradução (modelo local) e vetores para a busca |
| Índice | Qdrant (`nomad_qdrant`) | Trechos dos ZIMs, PDFs e EPUBs, com página ou capítulo de origem |
| Pipeline de prompt | `RagPipelineService` | Histórico, orçamento de tokens, contexto; agora aceita `renderContext` para quem precisa citar |
| Modo Sobrevivência | `SurvivalService` + `collections/survival.json` | Classifica o cenário (nível 1–6, ameaça, fase), localiza o usuário, busca primeiro nas obras de sobrevivência e instrui o modelo a citar e separar fato de recomendação |
| Assistente dos leitores | `AssistantController.reader` + `ReaderAssistantPanel` | Perguntar, Explicar, Resumir (por partes) e Traduzir o livro aberto |
| Tradução | `TranslationService` | Bergamot (app Biblioteca Traduzida) quando há o par de idiomas; senão o modelo local; cache por trecho (`translation_cache`) |
| Monitoramento | `/api/assistant/performance` + página **Configurações → Assistente local** | GPU (uso, VRAM, GTT, temperatura, consumo, clock) via sysfs, RAM, modelos carregados e tokens/s das últimas respostas |

## Hardware de referência e medições (24/11/2026)

RX 9060 XT 16 GB (Navi 44, gfx1200), Ryzen 7 5700X, 32 GB de RAM, Ollama 0.40.18, Flash Attention e cache KV q8_0, contexto de 16k nas medições de modelos (no app, a janela é escolhida pelo `ContextWindowService`; ver abaixo).

### Backend AMD: Vulkan × ROCm

O ROCm 7.2 que vem com o Ollama reconhece a placa nativamente (sem `HSA_OVERRIDE_GFX_VERSION`). O Vulkan (RADV) também. Medido com `gemma4:12b`:

| | ROCm | Vulkan (Mesa 26.3, host) | Vulkan (Mesa 25.2.8, imagem oficial) |
|---|---|---|---|
| Geração | 52,2 t/s | 68,9 t/s | 65,2 t/s |
| Prompt de 7,5k tokens | 1.165 t/s | 1.374 t/s | 996 t/s |
| Embeddings (embeddinggemma, 32 trechos) | 19,8/s | 40,6/s | 37,6/s |

**Decisão:** em RDNA 4 o padrão é Vulkan (`ai.amdBackend` = automático), com a imagem padrão do Ollama, só `/dev/dri` e `OLLAMA_VULKAN=1`. As demais placas AMD continuam em ROCm, porque nada foi medido nelas e o caminho ROCm tem histórico de campo (overrides de HSA, iGPUs). A escolha pode ser forçada em **Configurações → Assistente local** e vale na próxima reinstalação ou atualização do Assistente. A verificação de saúde da GPU e a remediação automática foram adaptadas para não tratar um container Vulkan como "falta o ROCm".

### Modelos de chat (português)

Três tarefas reais: RAG com ~2,2k tokens de trechos dos PDFs do Ministério da Saúde e do MMA, tradução EN→PT de um parágrafo da OMS e classificação de cenário em JSON.

| Modelo | Geração (ROCm / Vulkan) | VRAM real (sysfs) | Resposta com fontes | Tradução |
|---|---|---|---|---|
| gemma4:12b | 64 / 76 t/s | ~8,9 GB | fiel e completa | muito boa ("soros antiofídicos") |
| gemma4:e4b | 118 / 172 t/s | ~5,0 GB | fiel, mais curta | muito boa |
| qwen3.5:9b | 47 / 51 t/s | ~5,9 GB | fiel | boa (anglicismos) |
| qwen3:14b | 30 t/s | ~10,6 GB | fiel, pequenos acréscimos | boa |
| gpt-oss:20b | 63 t/s | ~12,7 GB | **inventou dados** (1 min de fervura, 3 L por pessoa, ração) e os atribuiu às fontes | boa |

**Decisão:** em 16 GB, `gemma4:12b` faz chat, leitores, sobrevivência e as tarefas auxiliares. Com `gemma4:e4b` e o embedding junto, a soma (~15,4 GB) não fica residente e o Ollama passa a descarregar modelos. O `gpt-oss:20b` fica marcado como não recomendado. Para outras quantidades de VRAM, `recommendModels` (`app/utils/model_recommendation.ts`) estima pelo tamanho medido de cada modelo e avisa que não mediu.

O `/api/ps` informa para o gemma4 uma VRAM implausível (0,6–1,2 GB). Por isso o painel usa o sysfs como fonte.

### Embeddings (busca em português)

18 perguntas em português sobre 2.036 trechos da biblioteca de sobrevivência, mais 2 páginas em inglês. Acerto = um trecho da obra certa contendo a resposta.

| Modelo | hit@1 | hit@5 | MRR@10 | Dimensão |
|---|---|---|---|---|
| nomic-embed-text v1.5 (antigo padrão) | 0,50 | 0,61 | 0,55 | 768 |
| nomic-embed-text-v2-moe | 0,78 | 1,00 | 0,86 | 768 (contexto de 512: trunca) |
| **embeddinggemma** | **0,83** | **1,00** | 0,88 | 768 |
| qwen3-embedding:0.6b | 0,67 | 0,94 | 0,80 | 1024 |
| bge-m3 | 0,83 | 0,94 | 0,88 | 1024 |

**Decisão:** índices novos usam `embeddinggemma`. O modelo é uma propriedade do **índice** (KV `rag.embeddingProfile`): vetores de modelos diferentes não se comparam. Um índice criado antes disso continua no nomic, e a troca é feita pelo botão **Reconstruir com EmbeddingGemma**, que reindexa tudo (`POST /api/rag/reset-and-rebuild {embeddingProfile}`).

### Piso de relevância por modelo

As notas da busca ficam numa escala diferente para cada modelo de embedding. O piso de 0,62 (calibrado para o nomic) descartava todos os trechos em 3 de 12 perguntas sob o `embeddinggemma`, e o modo Sobrevivência respondia sem fonte. Cada perfil tem agora seus pisos (`relevanceFloors` em `app/utils/embedding_profile.ts`):

| Perfil | Leniente | Equilibrado (padrão) | Rigoroso |
|---|---|---|---|
| nomic v1.5 | 0,55 | 0,62 | 0,66 |
| embeddinggemma | 0,45 | 0,50 | 0,55 |

Medido em 25/11/2026 sobre os 11 PDFs de sobrevivência (483 trechos): o melhor trecho das 12 perguntas no tema ficou entre 0,576 e 0,756, e as 6 perguntas fora do tema não passaram nem do limiar semântico (0,3). Com 0,50: 12/12 com a obra certa e 0/6 fora do tema com fonte. Sem um acervo de distração indexado, a calibração deve ser refeita com o harness de avaliação. Sem escolha do usuário, vale o Equilibrado do perfil do índice. Ao reconstruir com outro perfil, uma predefinição escolhida passa para a equivalente do novo perfil; um valor personalizado fica como está.

### Janela de contexto e recarregamentos

- **Custo do cache KV:** no gemma4, `head_count_kv` é uma lista por camada e 40 das 48 camadas são de janela deslizante (1.024 tokens). O cálculo antigo lia a lista como ausente e cobrava 1,5 MiB por token, o que prendia o modelo no piso de 4.096 tokens. Agora `computeKvCost` cobra 16 KiB por token nas camadas globais mais um custo fixo (~320 MiB) das deslizantes, ainda em f16 por segurança. Na RX 9060 XT: janela de 131.072 tokens, 12,5 GiB previstos pelo Ollama, 11,2 GB medidos no sysfs com o embedding junto.
- **`num_ctx` estável:** as chamadas auxiliares (classificação, tradução, resumo por partes, reescrita de consulta, juiz de relevância, sugestões) não informavam a janela, e o Ollama recarregava o modelo a cada troca (~8,5 s). O `OllamaService` agora reaproveita o último `num_ctx` enviado para o modelo. Só a primeira pergunta depois de iniciar o app ainda recarrega uma vez.

## Citações com página e capítulo

PDFs são indexados em janelas de páginas (`page_start`, `page_end`) e EPUBs por capítulo (`chapter`, `chapter_href`). Obras da Biblioteca ganham o título e o ano do catálogo. O rótulo de cada trecho no prompt vira `[Context 2 — Guia de animais peçonhentos do Brasil (2024), p. 40–41]`, e a lista **Fontes** mostra as páginas usadas. Nas obras da Biblioteca, cada página é um link que abre o leitor nela (`/library/read/<arquivo>?page=40`). Arquivos indexados antes disso não têm página; basta reindexá-los.

## Modo Sobrevivência

No chat, **Geral | Sobrevivência**. No modo Sobrevivência:

1. **Cenário:** classificação determinística por palavras-chave (ameaças, temas, fase, escopo), refinada pelo modelo local com lista fechada de ameaças e fases (JSON com gramática), com prazo de 8 s. Se o modelo falhar, vale a heurística. O cartão acima da resposta mostra nível, ameaça, fase e local, e diz que a classificação pode estar errada.
2. **Localização:** estado, ambiente (urbano ou rural) e cidade das configurações, trocáveis por conversa. Um local citado na pergunta ("em Manaus", "no semiárido") tem prioridade.
3. **Busca:** três consultas em paralelo: (a) só nas obras de sobrevivência relevantes ao cenário (ranqueadas por ameaça, tema, fase, região e nível); (b) na base inteira; (c) com termos em inglês da ameaça, para os ZIMs em inglês. Os resultados são deduplicados, com as obras brasileiras primeiro.
4. **Instruções:** o modelo é informado de que está offline e sem alertas, notícias ou avisos em tempo real, recebe a data de hoje e o intervalo de edições das obras indexadas, e precisa separar **Documentado nas fontes** (com citação), **Recomendação geral** e **Incertezas e limites**. Não pode inventar dados regionais, previsões, telefones, doses ou procedimentos, e não pode ensinar nada ilegal ou perigoso.

### Mapa de conhecimento (`collections/survival.json`)

- **Níveis 1–6**, do doméstico ao civilizacional, com escopo, duração, infraestrutura, recuperação e os exemplos do pedido. O nível mede extensão e gravidade, não o tipo de desastre.
- **Fases:** riscos e sinais, preparação, primeiras horas, 24–72 h, semanas ou meses, recuperação.
- **12 temas** (água, alimentos, abrigo, primeiros socorros, orientação, ferramentas, agricultura e pesca, energia e comunicação, segurança, psicologia e liderança, organização e decisão, recursos prolongados).
- **25 ameaças** com termos em português e inglês e a faixa típica de nível.
- **5 regiões** com as características definidas no pedido de 24/11/2026 (campo `source`). Servem para orientar a busca e a resposta, nunca como fato citável.
- **Obras:** cada obra da Biblioteca e cada ZIM de sobrevivência ligados a ameaças, temas, fases, regiões e níveis.

O mapa organiza; ele não é fonte. Os fatos vêm dos documentos recuperados.

## Leitores

O botão **Assistente local** (ícone de brilho) abre o painel:

- **Perguntar:** chat sobre o livro, com histórico da conversa no painel e busca nos outros trechos do mesmo livro (quando indexado).
- **Explicar:** o trecho selecionado, ou a página aberta.
- **Resumir:** a página, um intervalo de até 15 páginas (PDF) ou o capítulo (EPUB). Acima de 5 mil caracteres o resumo é feito por partes e depois combinado, com o progresso no painel.
- **Traduzir:** a seleção ou a página ou capítulo, para pt, en, es, fr, de ou it. Até 12 mil caracteres por pedido, segmentado em trechos de 1.200 caracteres, cada um com cache. O arquivo original nunca é alterado.

As páginas citadas na resposta abrem no próprio leitor.

## Tradução

1. **Bergamot** (app Biblioteca Traduzida, CPU): o proxy ganhou `GET /api/translate/languages` e `POST /api/translate` (texto puro, até 64 trechos e 20 mil caracteres, rota direta ou com pivô pelo inglês, por exemplo es→en→pt). Vem na imagem `nomad-translate` 0.2.0 (instalações novas). Numa instalação existente, a 0.1.2 continua até a atualização do serviço; sem a API, o app detecta e usa o modelo local.
2. **Modelo local:** prompt de tradutor estrito (sem comentários, preservando números, nomes e formatação), temperatura 0,1, duas chamadas simultâneas.
3. **Cache:** `translation_cache` (sha256 de origem + destino + texto). Abrir de novo a mesma página não custa nada.

## Biblioteca de sobrevivência

25 publicações oficiais brasileiras com a licença ou a permissão de reprodução impressa no próprio arquivo, curadas em `collections/curation/survival-library.json` e geradas por `scripts/build-library-entries.mjs`. O script baixa da URL oficial, confere a assinatura do PDF, procura a evidência da licença nas 8 primeiras páginas e calcula tamanho e SHA-256. Detalhes e obras recusadas estão em [`catalogo.md`](catalogo.md#biblioteca-de-sobrevivência).

O gov.br responde **403 a HEAD** e 206 a GET com Range. A sonda de download (`preflightDownload`) agora tenta um GET de 1 byte quando o HEAD é recusado e não há credenciais; sem isso, os 22 PDFs do gov.br falhariam no app.

## Configuração Rápida

- Os modelos medidos para o hardware detectado aparecem primeiro e vêm pré-selecionados num rascunho novo.
- Etapa Conteúdo: **Biblioteca de sobrevivência** (Nenhuma, Essencial, Padrão ou Completo; padrão Completo, ~130 MB de PDFs), disponível mesmo sem a Biblioteca de Informação.
- Região: estado, fuso, **ambiente** (urbano ou rural) e **cidade**.

## Teste ponta a ponta (25/11/2026)

Imagem de produção, rede Docker interna sem rota para fora (app e Ollama sem DNS nem acesso à internet), Ollama 0.40.18 oficial com Vulkan na RX 9060 XT, `gemma4:12b` e `embeddinggemma`. Com internet só na instalação: 11 PDFs de sobrevivência baixados pelo app em 10 s (gov.br pela sonda com `GET`) e indexados (483 trechos, página por trecho). Depois, offline:

| Caso | Resultado |
|---|---|
| Sobrevivência: enchente em Manaus | nível 2, inundação, preparação, AM/Norte; cita o caderno de inundações do MMA (p. 1–16) e outros |
| Sobrevivência: seca no semiárido, zona rural | seca e contaminação da água, semanas ou meses, Nordeste; cita o plano de seca e estiagem do MS (p. 12–25) |
| Sobrevivência: "o Guaíba vai transbordar amanhã?" | diz que não tem dados em tempo real e manda procurar a Defesa Civil |
| Leitor: explicar, perguntar, resumir 6 mil caracteres (2 partes) | respostas com a página; resumo por partes com progresso |
| Tradução EN→PT | 0,78 s pelo modelo; repetida, 3 ms do cache (o cache sobrevive ao reinício do app) |
| Desempenho | gemma4:12b ~60 t/s de geração e ~1.000 t/s de prompt; primeiro token de 3 a 7 s com o modelo carregado |

Defeitos achados e corrigidos neste teste: piso de relevância do nomic aplicado ao `embeddinggemma`; "para" lido como Pará; janela de 4k para o gemma4; recarregamentos por `num_ctx` ausente; manifesto embutido mais novo trocado pelo do GitHub (ver `catalogo.md`).

## Limites conhecidos

- **Sem dados em tempo real.** O agente diz isso e orienta a procurar a Defesa Civil local quando a pergunta depende da situação atual.
- **Classificação automática** pode errar; o cartão do cenário mostra o que foi entendido.
- **Fontes em português são poucas fora da saúde e da Defesa Civil.** Agricultura (Embrapa: todos os direitos reservados), primeiros socorros (SAMU, Fiocruz: sem licença no arquivo), psicologia em desastres (MDR: sem licença no arquivo) e cartografia (IBGE) ficaram de fora. Ver as pendências em `catalogo.md`.
- **Recomendações para outras GPUs** são estimadas, não medidas.
- O Bergamot precisa da imagem `nomad-translate` 0.2.0; instalações existentes a recebem pela atualização do serviço Biblioteca Traduzida.
- **Palavras-chave da busca híbrida sem acento:** `extractKeywords` apaga letras acentuadas e só remove stopwords em inglês (código do projeto original). Como índice e consulta passam pela mesma função, ainda casa; corrigir exige reindexar.
- O modelo às vezes cita um telefone ou SMS de serviço público mesmo instruído a não fazê-lo (no teste, o SMS 40199 da Defesa Civil, que é real).
