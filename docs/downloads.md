# Downloads inteligentes

Este documento cobre a infraestrutura de downloads do monolith-nomad: escolha de mirror, aria2c, retomada, SHA-256 e fallback. O código está em `admin/app/utils/`, e o ponto de entrada é `smart_download.ts`. A fila `downloads` (`admin/app/jobs/run_download_job.ts`) passa por ele para todo arquivo HTTP: ZIM, mapas, pacotes e dados.

## Fluxo

```
RunDownloadJob ──► smartDownload(url canônica)
                    1. fontes   download.kiwix.org? → <url>.meta4 (MirrorBrain): mirrors https + tamanho + SHA-256
                                outro host          → só a URL
                    2. ranking  benchmark (GET ranged pequeno) → ordena por medição; geografia só desempata
                    3. aria2c   segmentos espalhados nos melhores mirrors, SHA-256 conferido pelo aria2c
                    4. nativo   fallback: axios retomável, uma fonte por vez, backoff exponencial com jitter
                    ──► <arquivo>.tmp verificado ──► rename ──► onComplete(url canônica)
```

Regras que não mudam:

- **URL canônica.** O `jobId` (`sha256(url)`), o `InstalledResource.url` e o `onComplete` nunca veem a URL de um mirror. O mirror é escolhido *dentro* do job.
- **Credenciais só para a origem.** Cabeçalhos do chamador, como o `Authorization` de um Creator Pack, só vão para o host original. **Com cabeçalhos, o aria2c não é usado:** ele reenvia cabeçalhos próprios ao destino de um redirect, mesmo em outro host. O motor nativo (follow-redirects) remove o `Authorization` quando o redirect sai do host original. O User-Agent chega ao aria2c pelo stdin (`--input-file=-`) e nunca aparece no `ps`.
- **Nada parcial é instalado.** O download vai para `<arquivo>.tmp`, e o rename só acontece depois da checagem de tamanho e de SHA-256 (quando o hash é conhecido).
- **Fontes verificadas.** Só se busca metalink de `download.kiwix.org` e `lb.download.kiwix.org` (lista em `METALINK_HOSTS`). O segundo é o mesmo MirrorBrain: desde novembro de 2026 o `download.kiwix.org` responde 301 para ele, e o catálogo OPDS do Kiwix já entrega URLs `lb.`. Sem ele na lista, os downloads resolvidos pelo catálogo ficavam sem SHA-256 e sem mirrors. Os mirrors vêm da lista oficial do Kiwix, só em https, e os bytes são conferidos contra o SHA-256 publicado pelo próprio `download.kiwix.org`. **Um metalink sem SHA-256 não traz mirror nenhum:** o download vai só pela origem, porque nada conferiria o que um mirror serve. Nenhum mirror desconhecido é usado.
- **Sem SSRF pelos mirrors** (`admin/app/utils/host_safety.ts`). Uma lista de mirrors adulterada, ou um DNS envenenado, não pode apontar o servidor para a própria rede (MySQL, Redis, metadados de nuvem em `169.254.169.254`). Os mirrors passam por três checagens:
  1. **metalink:** só URL `https` na porta padrão, sem `usuário:senha@`, com hostname público (nada de IP literal, `localhost`, `.local`, `.internal` ou nome sem ponto);
  2. **`resolveSources`:** o DNS de cada mirror é resolvido, e **um único endereço não público** descarta o host. Contam como não públicos: RFC 1918, loopback, link-local, CGNAT, ULA, multicast, reservados, e as formas IPv6 que carregam um IPv4, julgadas por esse IPv4 (mapeado `::ffff:`, NAT64 `64:ff9b::/96`, 6to4 `2002::/16`). O Teredo (`2001::/32`) é recusado;
  3. **na conexão**, o que cobre redirects e DNS rebinding:
     - **motor nativo:** um `lookup` seguro refaz a checagem em toda conexão a um mirror, e um redirect só é aceito para `https` público na porta 443;
     - **aria2c:** quando a lista tem mirrors, ele passa pelo **connect guard** (`connect_guard.ts`), um proxy `CONNECT` em `127.0.0.1` passado por `--all-proxy`. O guard só abre túnel para a porta 443 de um hostname público, resolve o nome ele mesmo e recusa se algum endereço não for público, conectando no endereço que ele próprio checou. HTTP simples é recusado, e isso barra um redirect para `http://169.254.169.254/`. O TLS segue de ponta a ponta, e o aria2c continua verificando os certificados.
- A **sonda do benchmark nunca segue redirect** (`redirect: 'manual'`): um 3xx conta como falha da sonda.
- A **URL de origem nunca é filtrada:** é o que o usuário ou o catálogo pediu, e pode ser um servidor da LAN.
- **Atrás de um proxy do ambiente** (`HTTPS_PROXY`, `HTTP_PROXY`, `ALL_PROXY`), a checagem na conexão é desligada, nos dois motores. A conexão vai para o proxy, e checar o endereço dele (muitas vezes privado) quebraria todo download de mirror. As checagens 1 e 2 continuam valendo, e o proxy da rede passa a ser a barreira.

## Seleção de mirror

`mirror_selection.ts`, função `rankSources`:

1. **Mirrors medidos e saudáveis**, pela pontuação `vazão × 1/(1 + TTFB/2 s) × 0,5^falhas_recentes`.
2. **Mirrors ainda não medidos**, por camada de localização (mesmo país, depois mesma região, depois o resto) e, dentro da camada, pela `priority` do MirrorBrain.
3. Mirrors cuja última medição ou transferência falhou.
4. A URL de origem, sempre por último: o `download.kiwix.org` redireciona sozinho para um mirror. Quando há mirrors explícitos, o **aria2c não recebe a origem**: o redirect dela pode cair no `dumps.wikimedia.org`, e o limite por host não teria como ser aplicado. A origem continua como último recurso do motor nativo. Quando a origem é a única fonte, o aria2c a recebe com **1 conexão** (`HOST_CONNECTION_LIMITS['download.kiwix.org']`).

**A distância nunca decide sozinha.** Um mirror medido mais rápido vence um mais próximo.

### Benchmark

`mirror_benchmark.ts` funciona assim:

- Faz um GET `Range: bytes=0-(N-1)` por mirror. O padrão é N = 2 MiB, com todas as sondas em paralelo (uma requisição por host) e timeout de 5 s.
- Mede o TTFB e a vazão da amostra.
- **Só conta como sucesso** uma resposta 206 cujo total no `Content-Range` seja igual ao tamanho do metalink. Isso descarta servidores sem Range (não retomam) e mirrors com outra versão do arquivo.
- A medição vale por 6 h (`benchmarkTtlMs`).
- A vazão real de cada download concluído pelo motor nativo também entra nas estatísticas, com média exponencial (`updateHostStats`). Assim, a escolha melhora com o uso.
- As estatísticas ficam na memória do worker: sobrevivem entre jobs, mas não a um restart.

**Medição real, desta máquina em São Paulo, 20/11/2026 08:03 UTC.** O arquivo foi o `zimgit-medicine_en_2024-08.zim` (67 MiB), com amostra de 2 MiB:

| local | prioridade MirrorBrain | host | TTFB | vazão da amostra |
|---|---|---|---|---|
| nl | 4 | ftp.nluug.nl | 1503 ms | 1,74 MiB/s |
| us | 1 | ny.mirror.driftle.ss | 959 ms | 0,98 MiB/s |
| aq¹ | 7 | mirror-sites-in.mblibrary.info | 1474 ms | 0,77 MiB/s |
| us | 2 | wi.mirror.driftle.ss | 1512 ms | 0,64 MiB/s |
| dk | 6 | mirrors.dotsrc.org | 1502 ms | 0,61 MiB/s |
| fr | 5 | mirror.download.kiwix.org | 611 ms | 0,37 MiB/s |
| ca | 3 | mirror-sites-ca.mblibrary.info | falhou (timeout de 10 s) | — |

¹ `aq` é a localização publicada pelo MirrorBrain para esse host.

O que essa medição mostra:

- **Não existe mirror do Kiwix no Brasil nem na América do Sul.** O metalink diz "Mirrors which handle this country (BR)", e esses mirrors são dos EUA e do Canadá.
- Neste momento, o mais rápido a partir de São Paulo foi o da Holanda, não o primeiro indicado pelo MirrorBrain.
- Amostras pequenas são dominadas pelo início lento do TCP: os valores absolutos ficam abaixo da vazão sustentada e servem para **comparar** mirrors.
- Foi uma única medição, num único momento.

## aria2c

Arquivo `aria2.ts`. O pacote `aria2` vem do apt (Debian) na imagem do admin, pelo `Dockerfile` da raiz.

- As URIs do arquivo vão numa linha só, separadas por tab. O aria2c as trata como mirrors do mesmo arquivo e usa as seguintes como reserva.
- `--max-connection-per-server` tem padrão 4 e diminui para hosts com limite publicado (`HOST_CONNECTION_LIMITS`). O `dumps.wikimedia.org` publica um teto de 3 conexões **por IP** (lido em 20/11/2026) e bloqueia quem tenta contornar. Como a fila roda até 3 downloads ao mesmo tempo, cada download usa 1 conexão com esse host.
- `--uri-selector=inorder` e `split = conexões por servidor`: todas as conexões vão para o 1º mirror do ranking, e os demais ficam de reserva para erros (ver a investigação abaixo).
- `--checksum=sha-256=…` (quando conhecido), `--continue` e `--file-allocation=none`.
- Isolado do ambiente do container: `--no-conf` (ignora `aria2.conf`), `--no-netrc` (um `~/.netrc` não vaza credenciais), `--follow-metalink=false` e `--follow-torrent=false` (um `.metalink`/`.torrent` baixado é arquivo a instalar, nunca instrução para baixar outra coisa).
- Os erros são classificados **pelo código de saída**, porque o aria2c traduz as mensagens:
  - 9 → `InsufficientDiskSpaceError`;
  - 24 → `GatedContentAuthError`;
  - 32 (checksum) → apaga o `.tmp` e o `.aria2` e tenta o motor nativo.
- **Comportamento conferido com o aria2 1.37.0** (máquina de desenvolvimento) e um servidor local com Range. A suíte de testes também passa inteira (29/29, nada pulado) no **aria2 1.36.0 do Debian 12 + Node 22.23.5**, a mesma base da imagem do admin, num container `node:22.23.5-slim`:
  - um `.tmp` parcial do motor nativo é retomado;
  - SIGTERM deixa `<out>.aria2`, e a execução seguinte retoma;
  - um SHA-256 errado sai com código 32 e deixa o `.tmp` e o `.aria2`.
- **Falha depois de progresso** (rede, timeout, mirror caindo no meio): o `.tmp` e o `.aria2` **ficam**, e o erro (`Aria2PartialKeptError`) vai para a fila. A tentativa seguinte do BullMQ (10 tentativas, backoff exponencial a partir de 30 s) retoma com o aria2c. Antes, o parcial era apagado e o fallback nativo recomeçava do zero: um ZIM de 100 GB que caía em 95 % perdia tudo.
- **Falha sem progresso nesta execução** (nada novo além do que a tentativa anterior deixou, por exemplo um mirror que corta sempre no mesmo ponto): limpa e cai no motor nativo. Por isso as tentativas da fila não ficam presas no aria2c. O progresso é medido pelo tamanho do `.tmp`; um aria2c que só preencheu buracos abaixo do maior offset conta como "sem progresso" e cai no nativo, o que é seguro e só custa desempenho.
- **aria2c "terminou" com o tamanho errado:** apaga o `.tmp` e o `.aria2`, porque os bytes podem ter buracos.
- **O motor nativo nunca retoma um `.tmp` com `.aria2` ao lado.** O arquivo foi gravado em segmentos e pode ter buracos; o nativo retoma por tamanho e montaria um arquivo corrompido (sem checksum, em silêncio). Nesse caso, o `.tmp` e o `.aria2` são apagados antes do download nativo. Um `.aria2` sem `.tmp` (órfão) é apagado antes de o aria2c começar, e o cancelamento pela interface apaga os dois.

## Motor nativo (fallback)

Arquivo `downloads.ts`, função `doResumableDownload`. É o mesmo downloader do upstream, com estas mudanças:

- `preflightDownload()`: o HEAD (tamanho, Range, lista de MIME aceitos, 401/403 → conteúdo restrito) foi extraído para ser usado pelos dois motores, sem mudar o comportamento.
- `expectedSha256`:
  - num download do zero, o hash é calculado durante a transferência;
  - numa retomada, o arquivo é lido uma vez no fim;
  - se não bater, o `.tmp` é apagado e sai um `ChecksumMismatchError`.
- `doResumableDownloadWithRetry`: o atraso fixo de 2 s virou backoff exponencial com jitter total (começa em 2 s, teto de 60 s).
- User-Agent `monolith-nomad/1.0 (+https://github.com/jhonatanoliveira2/monolith-nomad)`. Ele continua necessário: o `dumps.wikimedia.org` devolve 403 para User-Agent genérico.
- O logger é carregado na primeira chamada (`lazy_logger.ts`), para o módulo poder ser testado com `node --test`.

O orquestrador tenta as fontes em ordem e retoma o mesmo `.tmp` no mirror seguinte. O `isMatchingResume` já impede misturar arquivos diferentes. A espera entre fontes também usa backoff com jitter. Por fora, o BullMQ continua com as mesmas 10 tentativas, com backoff exponencial a partir de 30 s.

Erros fatais (sem fallback):

- cancelamento;
- espaço em disco insuficiente;
- 401/403 **da origem**. Um 401 de mirror não é fatal, porque mirrors não recebem credenciais.

## Comparação real: aria2c × motor nativo (20/11/2026)

Condições das medições:

- dentro da imagem de produção (`monolith-nomad:dev-aria2`: Debian 12, Node 22.23.5, aria2 1.36.0);
- a partir de São Paulo;
- arquivo `zimgit-medicine_en_2024-08.zim` (70.179.585 bytes);
- cada rodada é um processo novo, com benchmark novo;
- **o SHA-256 conferiu em todas as rodadas**, e nenhuma deixou `.tmp` ou `.aria2` para trás.

"Download" é só a fase de transferência; "total" inclui o metalink e o benchmark.

| hora (UTC) | motor | fontes | download | total |
|---|---|---|---|---|
| antes de 08:22 | aria2c, `--min-split-size=16M`, sem filtro | 6 URIs (incluía mirrors < 1 MiB/s e a origem) | 13,9 s · 4,81 MiB/s | 31,2 s |
| antes de 08:22 | nativo | ny.mirror.driftle.ss | 3,3 s · 20,18 MiB/s | 15,6 s |
| 08:22 | aria2c, 16M, filtro ≥ 50 % do melhor | 4 URIs | 7,5 s · 8,96 MiB/s | 20,9 s |
| 08:22 | nativo | wi.mirror.driftle.ss (1º lugar na amostra) | **162,4 s · 0,41 MiB/s** | 173,6 s |
| 08:25 | aria2c, 16M, filtro | 4 URIs | 11,3 s · 5,92 MiB/s | 24,1 s |
| 08:26 | nativo | ny.mirror.driftle.ss | 4,9 s · 13,66 MiB/s | 16,5 s |
| 08:28 | aria2c, `4M`, filtro, sonda de 5 s | 3 URIs | 11,4 s · 5,86 MiB/s | 23,1 s |
| 08:28 | aria2c, 4M, filtro | 3 URIs | 14,1 s · 4,74 MiB/s | 26,2 s |
| 08:29 | aria2c, 4M, filtro | 4 URIs | 10,8 s · 6,17 MiB/s | 21,1 s |

### Investigação do aria2c (20/11/2026, 08:36–08:43 UTC)

**1. O aria2c em si não é o gargalo.** Todos os testes abaixo usam um único mirror (NY), direto, sem o orquestrador:

| ferramenta | vazão |
|---|---|
| curl, 1 conexão | 14,57 MiB/s |
| aria2c `-x1 -s1` | 15,42 MiB/s |
| aria2c `-x4 -s4` | 16,26 MiB/s |
| aria2c `-x8 -s8` | 14,65 MiB/s |

Cerca de 15–16 MiB/s (~130 Mbit/s) parece ser o teto da rota ou da conexão daqui. Mais conexões não ajudam.

**2. O problema era a distribuição entre mirrors.** Com `--uri-selector=adaptive` e `--split=8`, os segmentos vão para todos os mirrors da lista, e os lentos seguram o fim. Teste direto com os mesmos 3 mirrors, intercalado:

| seletor | rodadas |
|---|---|
| `adaptive` split 8 | 12,41 / 8,57 MiB/s |
| `inorder` split 4 (1 mirror e 2 de reserva) | 11,61 / 11,67 MiB/s |

**3. Mudanças adotadas**, cada uma medida no fluxo completo, dentro da imagem:

- `--uri-selector=inorder` e `split = conexões por servidor`. Todas as conexões vão para o 1º mirror do ranking, e os outros são reservas que o aria2c usa quando há erro.
- Benchmark medindo a vazão **só na segunda metade da amostra**, para tirar o início lento do TCP. A amostra passou a ler 2,5 a 5,6 MiB/s, em vez de ~1,6.
- Sondas em paralelo, uma por host. Antes eram 3 por vez, e dois timeouts de 5 s somavam ~10 s.

| fluxo completo (aria2c) | fase de download | total (com metalink e benchmark) |
|---|---|---|
| antes (adaptive, split 8), 5 rodadas | 4,74 a 8,96 MiB/s | 20,9 a 31,2 s |
| `inorder` + amostra corrigida, 08:40, 3 rodadas | 18,26 / 14,80 / 12,74 MiB/s | 15,4 / 16,3 / 17,9 s |
| + sondas em paralelo, 08:42, 2 rodadas | 16,57 / 5,90 MiB/s | 11,9 / 19,4 s |

Conclusões (13 rodadas do fluxo completo e 8 diretas, um arquivo de 67 MiB, um dia; não é estatística definitiva):

- **O aria2c agora chega à vazão do melhor mirror** na maioria das rodadas (12,7 a 18,3 MiB/s, contra ~15 MiB/s de um mirror sozinho), sem abrir mão das reservas.
- **Ainda há variação:** uma rodada fez 5,90 MiB/s. O mirror escolhido depende de uma amostra curta, e a rede oscila de minuto a minuto.
- **O custo fixo** (metalink + sondas) caiu de 10–13 s para ~8 s por arquivo. No worker, as medições valem por 6 h, então esse custo é pago uma vez por período, não por arquivo.
- **Descartado:** `--min-split-size` 16M → 4M não mostrou ganho (mantido pela granularidade). Mais conexões por servidor também não ajudaram (o teto é a rota).

Próximo passo possível, ainda não feito: usar a vazão observada durante o próprio download (o aria2c informa a velocidade) para atualizar o ranking e trocar de mirror no meio do arquivo.

## Configuração

Todas as variáveis são opcionais e estão em `admin/start/env.ts` e `admin/.env.example`. **Um valor inválido volta ao padrão e nunca impede o app de iniciar:** no schema do env, todas são strings opcionais, e quem valida é o `preferencesFromEnv` (`download_preferences.ts`). Os booleanos aceitam `1/true/yes/on` e `0/false/no/off`; qualquer outra coisa (por exemplo o erro de digitação `ture`) mantém o padrão, em vez de desligar a função em silêncio.

| variável | padrão | uso |
|---|---|---|
| `DOWNLOAD_ENGINE` | `auto` | `auto` (aria2c, se houver), `aria2`, `native` |
| `DOWNLOAD_LOCATION_COUNTRY` | `br` | país da instalação (ISO 3166-1 alfa-2) |
| `DOWNLOAD_LOCATION_REGION` | `sa` | continente: `af an as eu na oc sa` |
| `DOWNLOAD_USE_METALINK` | `true` | lista de mirrors e SHA-256 do Kiwix |
| `DOWNLOAD_MIRROR_BENCHMARK` | `true` | medir os mirrors antes de escolher |
| `DOWNLOAD_BENCHMARK_SAMPLE_BYTES` | `2097152` | tamanho da amostra (64 KiB a 16 MiB) |
| `DOWNLOAD_MAX_MIRRORS` | `5` | mirrors usados por arquivo (1 a 10) |
| `DOWNLOAD_ARIA2_PATH` | `aria2c` | binário |
| `DOWNLOAD_ARIA2_SPLIT` | `8` | segmentos por arquivo (1 a 16) |
| `DOWNLOAD_MAX_CONNECTIONS_PER_SERVER` | `4` | conexões por servidor (1 a 16) |

## Outros provedores (auditoria)

| provedor | onde | situação |
|---|---|---|
| **Kiwix / ZIM** | `zim_service`, `collection_update_service`, `kiwix-categories.json` | metalink, mirrors, benchmark, aria2c e SHA-256 (este documento) |
| **GitHub / Releases / raw** | mapas (`project-nomad-maps`), ZIM mini, catálogos | CDN de origem única (Fastly, com POP em São Paulo). Não há mirror para escolher; o ganho vem dos segmentos do aria2c. Não há hash publicado nesses catálogos |
| **Protomaps** | `map_service` (planeta), `run_extract_pmtiles_job` | download completo pela fila (aria2c). A extração regional usa o `go-pmtiles` com 8 threads próprias |
| **Docker Registry** | `docker_service.pullImage` (dockerode) | o pull é feito pelo daemon Docker do host. Mirror de registro (`registry-mirrors`) é configuração do host (`/etc/docker/daemon.json`), fora do app. As imagens já são verificadas por digest pelo próprio Docker |
| **Modelos de IA** | `ollama_service` (`/api/pull`) | o Ollama baixa do próprio registro e confere os digests por camada. O app só acompanha o progresso |
| **Tradutor** | `install/nomad-translate/fetch_models.py` | Firefox Remote Settings (CDN Mozilla), só com checagem de tamanho. Pendente: retry e hash (o registro publica hash) |
| **FDA (bulário)** | `download_drug_data_job` | `doResumableDownload` (motor nativo direto) |

## Testes

```bash
cd admin
node --import ts-node-maintained/register/esm --test tests/unit/download_mirrors.spec.ts tests/unit/smart_download.spec.ts
```

- `download_mirrors.spec.ts`: backoff, metalink (cópia reduzida de uma resposta real do MirrorBrain), `resolveSources`, ranking, preferências e a entrada e os argumentos do aria2c (com proteção contra injeção).
- `smart_download.spec.ts`: servidores HTTP locais reais (Range, 500, bytes corrompidos, tamanho diferente, 401, HTML no lugar do arquivo). Cobre:
  - fallback entre fontes;
  - SHA-256 errado;
  - retomada em outro mirror;
  - cabeçalhos só para a origem;
  - benchmark;
  - aria2c real em dois mirrors, checksum errado e fallback, e MIME recusado (esses são pulados se o `aria2c` não estiver instalado).
