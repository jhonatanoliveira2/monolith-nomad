# Perguntas frequentes (FAQ)

Respostas para as dúvidas mais comuns sobre o monolith-nomad.

> O monolith-nomad é uma distribuição independente e não oficial, derivada do Project N.O.M.A.D. Dúvidas sobre esta distribuição devem ir para as [issues deste repositório](https://github.com/jhonatanoliveira2/monolith-nomad/issues), não para o projeto original.

## Posso mudar as portas que o monolith-nomad usa?

Sim, você pode mudar as portas dos serviços principais (Central de Comando, MySQL, Redis). Veja a seção [Instalação avançada](README.md#instalação-avançada) do README.

As portas padrão publicadas no host são `8080` (Central de Comando) e `9999` (logs dos containers, via Dozzle).

Observação: só os serviços principais, definidos no arquivo `docker-compose.yml`, aceitam portas personalizadas. Os apps instaláveis (Ollama, Kiwix etc.) ainda não aceitam.

## Posso mudar o local onde os dados ficam guardados?

Sim. Edite o `docker-compose.yml` (na instalação padrão, `/opt/project-nomad/compose.yml`) e ajuste os bind mounts para apontar para o local desejado no host. Veja a seção [Instalação avançada](README.md#instalação-avançada) do README.

## Posso guardar os dados num disco externo ou num armazenamento de rede?

Resposta curta: sim, mas não fazemos isso por você (e recomendamos um disco local, pelo desempenho).

Resposta longa: caminhos personalizados, pontos de montagem e discos externos (como volumes iSCSI ou SMB/NFS) **são possíveis**, mas dependem da configuração do seu host antes de o monolith-nomad iniciar. Depois, basta passá-los pelo `compose.yml`. Isso é uma questão do *host*, não do monolith-nomad. Ele não tem como configurar isso por você, e o script de instalação não tem como prever todas as configurações possíveis.

## Posso rodar no macOS, no WSL2 ou numa distro que não seja baseada em Debian?

Não oficialmente. O sistema de referência é o Ubuntu (24.04 ou 26.04 LTS), e o instalador só roda em sistemas baseados em Debian. Veja [Por que é preciso um sistema baseado em Debian?](#por-que-é-preciso-um-sistema-baseado-em-debian)

O projeto original mantém um guia comunitário para WSL2 no Windows. Ele pode servir de referência, mas esta distribuição não testa nem dá suporte a esse caminho.

## Por que é preciso um sistema baseado em Debian?

O monolith-nomad mantém a mesma base do projeto original: os scripts de instalação e as configurações do Docker foram feitos e otimizados para distribuições Linux baseadas em Debian, com o Ubuntu como referência. Tecnicamente, dá para rodar os containers em outros sistemas que tenham Docker, mas o processo de instalação não foi testado nem otimizado para eles, então não há garantia de que vai funcionar bem.

O Linux baseado em Debian foi escolhido por ser muito usado, fácil de instalar e estável para rodar containers Docker.

Se você decidir rodar em outro sistema, pode encontrar problemas sem suporte e vai precisar de mais conhecimento técnico para resolvê-los.

## Posso rodar num Raspberry Pi ou em outro dispositivo ARM?

Não oficialmente. O monolith-nomad foi feito para a arquitetura x86-64 e não há imagens publicadas para ARM. O instalador avisa e espera 10 segundos antes de continuar numa arquitetura sem suporte, e a instalação provavelmente vai falhar.

Membros da comunidade do projeto original publicaram imagens e guias próprios para ARM, mas eles não têm suporte oficial e não foram testados com esta distribuição.

## Quais são os requisitos de hardware?

O monolith-nomad em si é leve e roda até em hardware x86-64 modesto, mas as ferramentas e os conteúdos que você instalar é que definem os requisitos. Veja a seção [Requisitos](README.md#requisitos) do README.

## O monolith-nomad tem outros idiomas além do inglês?

Sim. A interface, o instalador e a documentação estão em **português brasileiro (pt-BR)**, que é o idioma padrão, com datas e números no formato brasileiro. A estrutura de tradução (i18next) permite adicionar outros idiomas. As convenções estão em [`admin/inertia/locales/README.md`](admin/inertia/locales/README.md).

O conteúdo das ferramentas e dos acervos (Wikipédia, cursos, e-books) depende de cada fonte. Boa parte está em inglês, mas há acervos em português, como a Wikipédia em português no Kiwix.

## Com quais tecnologias o monolith-nomad é feito?

- **Docker:** containers da Central de Comando e das dependências dela
- **Node.js e TypeScript:** backend da Central de Comando, com o framework [AdonisJS](https://adonisjs.com/)
- **React:** frontend da Central de Comando, com [Vite](https://vitejs.dev/) e [Inertia.js](https://inertiajs.com/)
- **MySQL:** banco de dados da Central de Comando
- **Redis:** cache, tarefas em segundo plano, tarefas agendadas e outros processos internos
- **aria2c:** downloads segmentados e com vários mirrors ([`docs/downloads.md`](docs/downloads.md))

O monolith-nomad usa o padrão Docker-outside-of-Docker ("DooD"): a Central de Comando gerencia e orquestra outros containers Docker no host sem precisar rodar o Docker dentro de um container. Isso dá melhor desempenho e compatibilidade com mais ambientes, e ainda permite gerenciar os containers pela interface.

## Posso rodar o monolith-nomad numa máquina que já tem containers Docker?

Sim. Ele foi feito para conviver com outros containers e não interfere neles, desde que não haja conflito de portas ou falta de recursos.

Todos os containers do monolith-nomad têm o prefixo `nomad_` no nome, então são fáceis de identificar e gerenciar separadamente. Confira as portas dos serviços principais antes de instalar e ajuste-as se for preciso. O instalador verifica se as portas estão livres e para antes de criar qualquer coisa se alguma estiver ocupada.

## Por que o monolith-nomad precisa de acesso ao socket do Docker?

Veja [Com quais tecnologias o monolith-nomad é feito?](#com-quais-tecnologias-o-monolith-nomad-é-feito)

## Posso usar qualquer modelo de IA?

Por padrão, o Assistente de IA roda os modelos com o Ollama, num container Docker. Por isso, um modelo encontrado no Hugging Face, por exemplo, não funciona diretamente. A lista de modelos nas configurações do Assistente de IA (`/settings/models`) pode não mostrar todos os que você procura. Se você encontrou em <https://ollama.com/search> um modelo que não aparece na página de configurações, baixe-o com o comando abaixo, trocando `MODEL_NAME_HERE` pelo nome do modelo no site do Ollama:

```bash
curl -X POST -H "Content-Type: application/json" -d '{"model":"MODEL_NAME_HERE"}' http://localhost:8080/api/ollama/models
```

Também é possível usar um servidor compatível com a API da OpenAI (LM Studio, llama.cpp), inclusive em outro computador. Veja [IA em outro computador](README.md#ia-em-outro-computador).

## A IA funciona com GPU AMD?

Sim. O instalador detecta GPUs AMD (e o modelo gfx da placa) e grava essa informação para a Central de Comando. A aceleração ROCm é configurada automaticamente quando você instala o Assistente de IA. Não é preciso NVIDIA nem CUDA. GPUs NVIDIA continuam com suporte, pelo NVIDIA Container Toolkit.

## Sou obrigado a instalar os recursos de IA?

Não. Os recursos de IA (Ollama, Qdrant, o pipeline de RAG etc.) são opcionais, e o resto do monolith-nomad funciona sem eles.

## O monolith-nomad é gratuito mesmo? Tem custos escondidos?

Sim, é software livre e de código aberto, sob a Apache License 2.0, como o projeto original. Não há custos nem taxas para usá-lo, e não há planos de recursos "premium" ou pagos. O único custo é o do hardware em que você escolher rodá-lo.

## Os downloads são mais rápidos aqui?

O monolith-nomad mede os mirrors oficiais antes de baixar e escolhe pelo desempenho medido, não só pela distância. Usa o aria2c com download segmentado, retoma downloads interrompidos e confere o SHA-256 de cada arquivo antes de instalá-lo. Só são usados mirrors da lista oficial do Kiwix. As medições reais e os limites estão em [`docs/downloads.md`](docs/downloads.md).

## O monolith-nomad envia dados para algum servidor?

Não há telemetria. Os serviços online do projeto original (leaderboard de benchmark, newsletter, lista curada de modelos) ficam desligados por padrão. A lista completa e como religar cada um estão em [`docs/distribuicao.md`](docs/distribuicao.md).

## Com que rapidez os problemas reportados são resolvidos?

O monolith-nomad é mantido de forma independente, sem prazo garantido. Problemas graves, que afetam muita gente ou a segurança, têm prioridade. Antes de publicar uma correção, ela é testada para não introduzir novos problemas, o que também leva tempo.

## Encontrei um problema ou tenho uma dúvida que não está aqui. Onde peço ajuda?

Abra uma issue em <https://github.com/jhonatanoliveira2/monolith-nomad/issues>, usando o modelo de relato de bug. Para vulnerabilidades de segurança, **não** abra issue pública: siga o [`SECURITY.md`](SECURITY.md).

## Tenho uma sugestão de recurso ou melhoria. Como envio?

Abra uma issue em <https://github.com/jhonatanoliveira2/monolith-nomad/issues> com o modelo de sugestão de recurso. Antes, procure se já existe uma sugestão parecida.

## Abri um PR. Quanto tempo leva para ser revisado?

Depende da complexidade da mudança, da necessidade de testes ou ajustes e do tempo disponível do mantenedor. Seguir o [`CONTRIBUTING.md`](CONTRIBUTING.md) (issue antes, testes, commits convencionais) agiliza a revisão.
