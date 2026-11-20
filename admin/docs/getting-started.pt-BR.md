# Primeiros passos com o monolith-nomad

Este guia ajuda você a aproveitar ao máximo o seu servidor monolith-nomad.

---

## Requisitos do sistema

Se o monolith-nomad já está rodando, você pode pular esta seção. Ela serve para quando você planeja um segundo servidor, vai trocar de hardware ou está ajudando outra pessoa a instalar.

### Sistema operacional

O monolith-nomad roda em Linux baseado em Debian.

| Nível de suporte | Sistema operacional |
|---|---|
| **Recomendado** | Ubuntu 26.04 LTS |
| **Também suportado** | Ubuntu 24.04 LTS, Debian 12 |
| **Suporte da comunidade** | Windows via WSL2, outros derivados do Debian |

O Ubuntu 26.04 LTS é a versão em que o projeto é testado e a recomendada para instalações novas. Se você já usa o 24.04 LTS ou o Debian 12, não precisa reinstalar: os dois continuam suportados.

O Ubuntu Desktop é a escolha mais amigável para quem vem do Windows ou do macOS. O Ubuntu Server funciona igualmente bem se você se sente à vontade no terminal, e o monolith-nomad não precisa de ambiente gráfico em nenhum dos casos, porque tudo é acessado pelo navegador.

O macOS e distribuições que não derivam do Debian, como Fedora ou Arch, não são suportados oficialmente.

### Instalação

Num sistema suportado, a instalação é feita pelo script deste fork:

```bash
sudo apt-get install -y curl && \
curl -fsSL https://github.com/jhonatanoliveira2/monolith-nomad/releases/latest/download/install_nomad.sh \
  -o install_nomad.sh && \
sudo bash install_nomad.sh
```

### Hardware

O monolith-nomad em si é leve. O que define os requisitos é o conteúdo e as ferramentas que você escolhe instalar, e se você quer rodar IA localmente.

**Mínimo, sem IA local:**

- processador dual-core de 2 GHz
- 4 GB de RAM
- 5 GB de espaço livre em disco, mais espaço para o conteúdo que você baixar

**Recomendado, com IA local:**

- AMD Ryzen 7 ou Intel Core i7, ou superior
- 32 GB de RAM
- NVIDIA RTX 3060 ou equivalente AMD; mais VRAM permite rodar modelos maiores
- 250 GB ou mais de espaço livre em disco, de preferência SSD

Uma conexão estável com a internet só é necessária durante a instalação. Depois disso, o monolith-nomad foi feito para rodar totalmente offline.

### Sobre os drivers de GPU

O instalador configura o Docker e o NVIDIA Container Toolkit para você, mas **não** instala o driver da GPU. Ele precisa estar no host antes.

No Ubuntu, o jeito mais fácil é marcar **"Instalar software de terceiros para placas de vídeo e Wi-Fi"** durante a instalação do sistema. Se você pulou essa etapa ou adicionou a GPU depois, instale o driver primeiro e então use **Forçar reinstalação** no Assistente de IA, no [Depósito de Apps](/supply-depot), para que ele passe a usá-la.

Sem GPU, o Assistente de IA continua funcionando. Ele só roda na CPU, o que é bem mais lento.

---

## Assistente de Configuração Rápida

Se é a primeira vez que você usa o monolith-nomad, o assistente de Configuração Rápida ajuda a deixar tudo configurado.

**[Abrir a Configuração Rápida →](/easy-setup)**

![Assistente de Configuração Rápida, etapa 1: escolha os recursos](/docs/easy-setup-step1.webp)

O assistente tem quatro etapas simples:
1. **Recursos**: escolha o que ativar: Biblioteca de Informação, Assistente de IA, Plataforma de Educação, Mapas, Ferramentas de Dados e Notas
2. **Mapas**: selecione as regiões geográficas para os mapas offline
3. **Conteúdo**: escolha coleções de conteúdo selecionadas nos níveis Essencial, Padrão ou Completo

![Níveis de conteúdo: Essencial, Padrão e Completo](/docs/easy-setup-tiers.webp)
4. **Revisão**: confirme as escolhas e comece os downloads

Dependendo do que você escolheu, os downloads podem demorar. Você pode acompanhar o progresso nas Configurações, continuar usando os recursos já instalados ou deixar o servidor ligado durante a noite para downloads grandes.

Os downloads de conteúdo do Kiwix são inteligentes: o servidor consulta a lista oficial de mirrors, mede quais respondem mais rápido a partir da sua conexão, baixa com o aria2c e confere o SHA-256 de cada arquivo antes de instalá-lo. Um download interrompido é retomado de onde parou, e nenhum arquivo incompleto é instalado.

---

## Conheça as ferramentas

### Biblioteca de Informação: conhecimento offline (Kiwix)

A Biblioteca de Informação guarda versões compactadas de sites e obras de referência que funcionam sem internet.

**O que inclui:**
- a Wikipédia completa (milhões de artigos)
- referências médicas e guias de primeiros socorros
- guias práticos e informações de sobrevivência
- livros clássicos do Project Gutenberg

**Como usar:**
1. Clique em **Biblioteca de Informação** na tela inicial da Central de Comando ou no [Depósito de Apps](/supply-depot)
2. Escolha uma coleção (como a Wikipédia)
3. Pesquise ou navegue como no site normal

---

### Plataforma de Educação: cursos offline (Kolibri)

A Plataforma de Educação oferece cursos completos que funcionam offline.

**O que inclui:**
- cursos em vídeo da Khan Academy
- matemática, ciências, leitura e mais
- acompanhamento do progresso de cada aluno
- conteúdo para todas as idades

**Como usar:**
1. Clique em **Plataforma de Educação** na tela inicial da Central de Comando ou no [Depósito de Apps](/supply-depot)
2. Entre ou crie uma conta de aluno
3. Navegue pelos cursos e comece a aprender

**Dica:** o Kolibri aceita vários usuários. Crie uma conta para cada pessoa da família para acompanhar o progresso individual.

---

### Assistente de IA: chat integrado

![Interface do chat de IA](/docs/ai-chat.webp)

O monolith-nomad inclui um chat de IA integrado, com tecnologia Ollama. Ele roda inteiramente no seu servidor: não precisa de internet e não envia dados para lugar nenhum.

**O que ele faz:**
- responde perguntas sobre qualquer assunto
- explica conceitos complexos de forma simples
- ajuda a escrever e revisar textos
- consulta os documentos enviados à Base de Conhecimento
- ajuda a ter ideias e a resolver problemas

**Como usar:**
1. Clique em **Chat de IA** na Central de Comando ou vá para o [Chat](/chat)
2. Digite sua pergunta ou pedido
3. A IA responde em tom de conversa

**Dica:** seja específico. Em vez de "fale sobre plantas", tente "quais hortaliças crescem bem na sombra?".

**Observação:** o Assistente de IA precisa ser instalado antes. Ative-o na Configuração Rápida ou instale-o pelo [Depósito de Apps](/supply-depot).

**Aceleração por GPU:** se o servidor tem uma GPU NVIDIA, o instalador do monolith-nomad configura o suporte para você (ele instala o [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html) e configura o Docker automaticamente). Você só precisa do driver NVIDIA no host, que no Ubuntu vem ao marcar "Instalar software de terceiros" durante a instalação. Com GPU, as respostas da IA ficam muito mais rápidas (de 10 a 20 vezes). Se você adicionar uma GPU depois, vá ao [Depósito de Apps](/supply-depot) e use **Forçar reinstalação** no Assistente de IA para ativá-la.

---

### Base de Conhecimento: IA que conhece seus documentos

![Interface de envio da Base de Conhecimento](/docs/knowledge-base.webp)

A Base de Conhecimento permite enviar documentos para que a IA os consulte ao responder. Ela usa busca semântica (RAG com Qdrant) para encontrar as informações relevantes nos arquivos enviados.

**Tipos de arquivo aceitos:**
- PDFs, arquivos de texto e outros formatos de documento
- a documentação do monolith-nomad é carregada automaticamente quando o Assistente de IA é instalado

**Como usar:**
1. Vá para a **[Base de Conhecimento →](/knowledge-base)**
2. Envie seus documentos (PDFs, arquivos de texto etc.)
3. Os documentos são processados e indexados automaticamente
4. Faça perguntas no chat de IA: a IA consulta os documentos enviados quando forem relevantes
5. Remova os documentos de que não precisa mais: eles são apagados do índice e do armazenamento local

**Exemplos de uso:**
- enviar planos de emergência para consulta rápida durante uma crise
- carregar manuais técnicos e procedimentos operacionais para locais de trabalho sem internet
- adicionar guias curriculares para o ensino domiciliar
- guardar artigos científicos para trabalhos acadêmicos

---

### Mapas: navegação offline

![Visualizador de mapas offline](/docs/maps.webp)

Veja mapas sem internet. Baixe as regiões de que precisa antes de ficar offline.

**Como usar:**
1. Clique em **Mapas** na Central de Comando
2. Navegue arrastando e dando zoom
3. Procure lugares pela barra de busca

**Para adicionar mais regiões de mapa:**
1. Vá para **Configurações → Gerenciador de Mapas**
2. Selecione as regiões de que precisa
3. Clique em Baixar

**Dica:** baixe os mapas das áreas por onde você costuma passar e, por precaução, das regiões vizinhas.

**[Abrir os Mapas →](/maps)**

---

## Gerenciando o servidor

### Adicionar mais conteúdo

Conforme suas necessidades mudam, você pode adicionar conteúdo a qualquer momento:

- **Mais apps:** Configurações → Depósito de Apps
- **Mais referências:** Configurações → Explorador de Conteúdo ou Gerenciador de Conteúdo
- **Mais regiões de mapa:** Configurações → Gerenciador de Mapas
- **Mais conteúdo educativo:** pelo navegador de conteúdo do próprio Kolibri

### Seletor da Wikipédia

![Explorador de Conteúdo: navegue e baixe pacotes da Wikipédia e coleções selecionadas](/docs/content-explorer.webp)

O monolith-nomad tem uma ferramenta própria para navegar e baixar pacotes da Wikipédia.

**Como usar:**
1. Vá para o **[Explorador de Conteúdo →](/settings/zim/remote-explorer)**
2. Navegue pelos pacotes da Wikipédia disponíveis, por idioma e tamanho
3. Selecione e baixe os pacotes que quiser

**Observação:** escolher outro pacote da Wikipédia substitui a versão baixada antes. Só uma seleção da Wikipédia fica ativa por vez.

### Benchmark do Sistema

![Benchmark do Sistema com a Pontuação do Sistema e a Etiqueta de Montador](/docs/benchmark.webp)

Meça o desempenho do seu hardware.

**Como usar:**
1. Vá para o **[Benchmark do Sistema →](/settings/benchmark)**
2. Escolha o tipo de benchmark: Completo, Só Sistema ou Só IA
3. Veja a sua Pontuação do Sistema (uma média ponderada do desempenho de CPU, memória, disco e IA)

**Leaderboard da comunidade:** o compartilhamento de resultados (com a Etiqueta de Montador, uma identidade como "Tactical-Llama-1234") usa um serviço online do projeto original. Nesta distribuição ele fica **desligado por padrão**: a seção de compartilhamento não aparece e nenhum resultado é enviado. Quem administra o servidor pode religá-lo pela variável `BENCHMARK_LEADERBOARD_URL`. Mesmo ligado, só benchmarks completos com dados de IA podem ser compartilhados.

### Manter tudo atualizado

Enquanto tiver internet, verifique as atualizações de tempos em tempos:

1. Vá para **Configurações → Verificar Atualizações**
2. Se houver atualizações, clique para instalar
3. Aguarde a conclusão (o servidor vai reiniciar)

As atualizações vêm das releases publicadas no repositório deste fork. As atualizações de conteúdo (Wikipédia, mapas etc.) são gerenciadas separadamente das atualizações de software.

**Atualizações automáticas:** o monolith-nomad também pode se manter atualizado sem que você precise verificar. Software, apps instalados e conteúdo podem ser configurados, cada um, para atualizar automaticamente, se você ativar, com verificações de segurança e uma janela de horário que você controla. Veja o quadro completo no **[guia de Atualizações](/docs/updates)**.

**Canal de Acesso Antecipado:** quer os recursos mais novos antes de chegarem à versão estável? Ative o Canal de Acesso Antecipado na página Verificar Atualizações para receber versões candidatas (release candidates). Você pode voltar ao canal estável quando quiser.

### Acompanhar a saúde do sistema

Confira o servidor quando quiser:

1. Vá para **Configurações → Sistema**
2. Veja o uso de CPU, memória e armazenamento
3. Confira o tempo de atividade e o estado do sistema

---

## Dicas para melhores resultados

### Antes de ficar offline

- **Atualize tudo**: rode as atualizações de software e de conteúdo
- **Baixe o que precisa**: mapas, referências, conteúdo educativo
- **Teste**: confirme que os recursos funcionam enquanto ainda há internet para resolver problemas

### Gerenciar o armazenamento

O armazenamento do servidor é limitado. Priorize:
- o conteúdo que você realmente vai usar
- referências críticas (medicina, sobrevivência)
- os mapas da sua região
- conteúdo educativo adequado às suas necessidades

Confira o uso do armazenamento em **Configurações → Sistema**.

### Onde buscar ajuda

- **Documentação no app:** você está lendo agora
- **Assistente de IA:** faça uma pergunta no [Chat de IA](/chat)
- **Notas de versão:** veja o que mudou em cada versão
- **Problemas e sugestões:** [GitHub Issues do monolith-nomad](https://github.com/jhonatanoliveira2/monolith-nomad/issues)

---

## Próximos passos

Você está pronto para usar o monolith-nomad. Algumas coisas para experimentar:

1. **Pesquise algo**: procure um assunto na Biblioteca de Informação
2. **Aprenda algo**: comece um curso da Khan Academy na Plataforma de Educação
3. **Faça uma pergunta**: converse com a IA no [Chat de IA](/chat)
4. **Explore os mapas**: encontre o seu bairro no visualizador de Mapas
5. **Envie um documento**: adicione um PDF à [Base de Conhecimento](/knowledge-base) e pergunte à IA sobre ele

Aproveite o seu servidor de conhecimento offline!
