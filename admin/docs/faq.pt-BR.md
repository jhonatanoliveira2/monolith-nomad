# Perguntas Frequentes

## Geral

### Preciso de internet?
Só para instalar, baixar conteúdo e atualizar. Depois disso, tudo funciona offline.

### Qual sistema operacional?
**Ubuntu 26.04 LTS** (recomendado), Ubuntu 24.04 LTS ou Debian 12. Requisitos e instalação: [Primeiros passos](/docs/getting-started).

### Quanta RAM?
- **Sem IA:** o conjunto inteiro usa menos de 1 GB (Central 241 MB, MySQL 444 MB, Kiwix 101 MB, Redis 9 MB, índice 155 MB). 4 GB bastam.
- **Com IA:** o Ollama ocioso usa ~1,2 GB, e o modelo ocupa mais ou menos o tamanho do download (um 8B pede ~4,6 GB). 8 GB para um modelo pequeno, 16 GB confortável, 32 GB para modelos maiores.
- Com GPU dedicada, o modelo vai para a VRAM; sem ela, usa a RAM.

### Quanto disco?
~5 GB para o sistema (deixe 10 GB livres), ~25 GB com a IA. O conteúdo soma à parte: Wikipédia completa em português ~20 GB (em inglês ~120 GB), modelos de IA 10 a 40 GB. A [Configuração Rápida](/easy-setup) mostra o total e o espaço que sobra antes de baixar.

## Conteúdo

### O que são os perfis Essencial, Padrão e Completo?
Níveis de cada área: **Essencial** é o núcleo (menor download), **Padrão** soma materiais complementares e **Completo** traz tudo. Há também a seleção personalizada, item a item.

### Por que alguns itens estão desligados?
O conteúdo em português (e o multilíngue) entra por padrão. Itens em inglês ficam desligados e podem ser ativados por área ou um a um; cada item mostra o idioma.

### Como os downloads funcionam?
Para o Kiwix: lista oficial de mirrors, medição a partir da sua conexão, aria2c com retomada e SHA-256 conferido antes de instalar. Um arquivo incompleto ou corrompido nunca é instalado. Tudo aparece em [Downloads](/downloads), onde dá para cancelar e tentar de novo.

### Como adiciono a Wikipédia ou outros ZIMs?
[Explorador de Conteúdo](/settings/zim/remote-explorer). Trocar a edição da Wikipédia substitui a anterior.

### Posso usar os meus arquivos?
Sim: envie PDFs e textos para a [Base de Conhecimento](/chat?knowledge_base=true) e a IA passa a consultá-los.

### Como adiciono cursos?
No Kolibri, como administrador: **Device → Channels → Import**.

## IA

### Como ativo a GPU?
1. Instale o driver no host (NVIDIA: o instalador cuida do Container Toolkit).
2. No [Depósito de Apps](/supply-depot), use **Forçar reinstalação** no Assistente de IA.

Os modelos baixados são preservados. Com GPU a IA fica de 10 a 20 vezes mais rápida.

### Aparece "repasse da GPU não está funcionando"
A GPU existe no host, mas não no container. Use o botão de reinstalar o Assistente de IA.

### O Benchmark envia resultados?
Não. O leaderboard online fica desligado por padrão; para religar, defina `BENCHMARK_LEADERBOARD_URL`.

## Problemas comuns

| Problema | O que fazer |
|---|---|
| Página em branco | Espere 30 s, recarregue; confira o serviço em [Sistema](/settings/system) e reinicie-o no Depósito de Apps |
| Mapa cinza | Baixe uma região no [Gerenciador de Mapas](/settings/maps) e recarregue |
| `Failed to load the XML library file` | Pare o Kiwix, espere 15 s, inicie; se persistir, **Forçar reinstalação** |
| IA lenta | Use GPU, um modelo menor ou feche outros programas |
| Chat indisponível | Instale o Assistente de IA no Depósito de Apps |
| Envio à Base de Conhecimento parado | Documentos grandes demoram; confira se o Assistente está rodando |
| Download parado | Veja a conexão e o espaço livre; cancele e repita em [Downloads](/downloads) |
| "Serviço indisponível" | Espere 1 a 2 minutos ou reinicie o serviço |
| Senha do Kolibri | Um administrador redefine no próprio Kolibri |

## Atualizações

- **Software:** [Atualizações](/settings/update). Leva de 2 a 5 minutos; se falhar, a versão anterior continua rodando.
- **Automáticas:** opcionais e desligadas por padrão, numa janela de horário sua, sem saltos de versão principal. Ver [Atualizações](/docs/updates).
- **Conteúdo:** separado do software, pelo Gerenciador de Conteúdo ou pelas atualizações automáticas de conteúdo.

### Pela linha de comando

```bash
sudo bash /opt/project-nomad/start_nomad.sh    # iniciar
sudo bash /opt/project-nomad/stop_nomad.sh     # parar
sudo bash /opt/project-nomad/update_nomad.sh   # atualizar a Central (os apps, pela interface)
```

Desinstalar (apaga todos os dados):

```bash
curl -fsSL https://github.com/jhonatanoliveira2/monolith-nomad/releases/latest/download/uninstall_nomad.sh -o uninstall_nomad.sh
sudo bash uninstall_nomad.sh
```

## Privacidade

- Buscas, conversas e documentos ficam no servidor. A IA roda localmente.
- O teste de conexão consulta só `1.1.1.1` e `api.github.com`.
- O servidor fica acessível a quem estiver na sua rede local. Em redes públicas, proteja o acesso.

Encontrou um bug? [Abra uma issue](https://github.com/jhonatanoliveira2/monolith-nomad/issues).
