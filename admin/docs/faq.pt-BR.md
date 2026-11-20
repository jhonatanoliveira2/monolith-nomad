# Perguntas Frequentes

## Perguntas gerais

### O que é o monolith-nomad?
O monolith-nomad é um servidor pessoal que dá acesso a conhecimento, educação e assistência de IA sem precisar de conexão com a internet. Ele roda no seu próprio hardware, mantendo os seus dados privados e acessíveis a qualquer momento. É uma distribuição independente derivada do Project N.O.M.A.D., com interface em português, tema visual Nothing e downloads inteligentes.

### Preciso de internet para usar o monolith-nomad?
Não, e essa é justamente a ideia. Depois que o conteúdo é baixado, tudo funciona offline. Você só precisa de internet para:
- baixar conteúdo novo
- atualizar o software
- sincronizar as versões mais recentes da Wikipédia, dos mapas etc.

### Que sistema operacional o monolith-nomad precisa?
Linux baseado em Debian. **Para instalações novas, recomendamos o Ubuntu 26.04 LTS, que é onde o projeto é testado.**

O Ubuntu 24.04 LTS e o Debian 12 também são suportados, então não é preciso reinstalar se você já usa um deles. No Windows, o uso via WSL2 tem apenas suporte da comunidade.

O macOS e distribuições que não derivam do Debian, como Fedora ou Arch, não são suportados oficialmente. O monolith-nomad não precisa de ambiente gráfico, então o Ubuntu Server é uma boa escolha se você se sente à vontade no terminal.

Com o sistema instalado, rode o instalador deste fork:

```bash
sudo apt-get install -y curl && \
curl -fsSL https://github.com/jhonatanoliveira2/monolith-nomad/releases/latest/download/install_nomad.sh \
  -o install_nomad.sh && \
sudo bash install_nomad.sh
```

### De que hardware eu preciso?
O monolith-nomad foi pensado para hardware capaz, principalmente se você quer usar os recursos de IA. Recomendado:
- CPU moderna com vários núcleos (o AMD Ryzen 7 com gráficos Radeon é o equilíbrio preferido da comunidade)
- 16 GB de RAM ou mais (32 GB ou mais para o melhor desempenho da IA)
- armazenamento SSD (o tamanho depende do conteúdo: 500 GB no mínimo, 1 TB ou mais recomendado)
- GPU NVIDIA ou AMD recomendada para respostas mais rápidas da IA

Os requisitos mínimos e recomendados estão detalhados no [Guia de Primeiros Passos](/docs/getting-started).

### Quanta RAM eu preciso?

**Sem o Assistente de IA, todo o conjunto ocupa menos de 1 GB.** Medido numa
instalação em funcionamento: a Central de Comando usa 241 MB, o MySQL 444 MB, o Redis 9 MB, o Kiwix 101 MB e o
índice da Base de Conhecimento 155 MB. Por isso 4 GB é um mínimo real, e não uma
margem de segurança.

**A variável é a IA, e quem pesa é o modelo, não o monolith-nomad.** O Ollama ocioso usa
cerca de 1,2 GB, e um modelo precisa de aproximadamente o tamanho do download residente na memória enquanto responde,
então um modelo de 8B com ~4,6 GB pede mais ou menos isso a mais. **8 GB dão para um modelo pequeno, 16 GB são confortáveis, e 32 GB são a recomendação se você quer rodar modelos maiores.**

De onde vem essa memória depende do hardware. Com uma GPU dedicada, o modelo
é carregado na VRAM e não usa a RAM do sistema, então é a VRAM que limita quais
modelos você consegue rodar. Com GPU integrada ou sem GPU, ele usa a RAM
do sistema, por isso uma máquina só com CPU precisa de mais RAM.

### Quanto armazenamento eu preciso?

**Para instalar o monolith-nomad em si: cerca de 5 GB, então deixe 10 GB livres.** Isso cobre a
Central de Comando e o banco de dados, antes de qualquer conteúdo. Adicionar o Assistente de IA
leva o total a cerca de 25 GB, porque o Ollama e um modelo de uso geral são
grandes.

Depois disso, depende só do que você baixar:
- Wikipédia completa (em inglês): ~95 GB
- cursos da Khan Academy: ~50 GB
- referências médicas: ~500 MB
- mapas de estados dos EUA: ~2 a 3 GB cada
- modelos de IA: 10 a 40 GB, conforme o modelo

Comece pelo essencial e acrescente conforme a necessidade.

---

## Perguntas sobre conteúdo

### Como adiciono mais conteúdo da Wikipédia?
1. Vá para **Configurações** (menu → Configurações)
2. Clique em **Explorador de Conteúdo**
3. Navegue pelos pacotes da Wikipédia disponíveis
4. Clique em Baixar nos itens que quiser

Você também pode usar o **Explorador de Conteúdo** para navegar por todo o conteúdo ZIM disponível além da Wikipédia.

### Como os downloads funcionam?
Para o conteúdo do Kiwix, o monolith-nomad lê a lista oficial de mirrors publicada pelo `download.kiwix.org`, mede rapidamente os mirrors a partir da sua conexão e baixa do mais rápido com o aria2c, deixando os outros como reserva. Antes de instalar, ele confere o tamanho e o SHA-256 publicado pelo Kiwix. Um download interrompido é retomado, e um arquivo incompleto ou corrompido nunca é instalado. Outros conteúdos (mapas, catálogos) vêm de uma única origem e também passam pela fila de downloads com retomada.

### Como adiciono mais cursos?
1. Abra o **Kolibri**
2. Entre como administrador
3. Vá para **Device → Channels** (Dispositivo → Canais)
4. Navegue e importe os canais disponíveis

### Quão atualizado é o conteúdo?
O conteúdo é tão atual quanto o seu último download. As cópias da Wikipédia costumam ser atualizadas todo mês. Confira as datas nos nomes ou nas descrições dos arquivos.

### Posso adicionar os meus próprios arquivos?
Sim, com a Base de Conhecimento. Envie PDFs, arquivos de texto e outros documentos para a [Base de Conhecimento](/knowledge-base), e a IA pode consultá-los ao responder suas perguntas. Ela usa busca semântica para encontrar as informações relevantes nos arquivos enviados.

Para o conteúdo do Kiwix, o monolith-nomad usa arquivos ZIM padrão. Para conteúdo educativo, o Kolibri usa o próprio formato de canais.

### O que são os níveis das coleções selecionadas?
Ao escolher conteúdo no assistente de Configuração Rápida ou no Explorador de Conteúdo, as coleções são organizadas em três níveis:
- **Essencial**: o conteúdo central da categoria (o menor download)
- **Padrão**: o Essencial mais conteúdos úteis adicionais
- **Completo**: tudo o que há disponível na categoria (o maior download)

Isso ajuda a equilibrar a cobertura do conteúdo com o uso do armazenamento.

---

## Perguntas sobre IA

### Como uso o chat de IA?
1. Vá para o [Chat de IA](/chat) pela Central de Comando
2. Digite sua pergunta ou pedido
3. A IA responde em tom de conversa

A IA precisa ser instalada antes: ative-a na Configuração Rápida ou instale-a pela página do [Depósito de Apps](/supply-depot).

### Como envio documentos para a Base de Conhecimento?
1. Vá para a **[Base de Conhecimento →](/knowledge-base)**
2. Envie seus documentos (PDFs, arquivos de texto etc.)
3. Os documentos são processados e indexados automaticamente
4. Faça perguntas no chat de IA: a IA consulta os documentos enviados quando forem relevantes

Você também pode remover documentos da Base de Conhecimento quando não precisar mais deles.

A documentação do monolith-nomad é adicionada automaticamente à Base de Conhecimento quando o Assistente de IA é instalado.

### O que é o Benchmark do Sistema?
O Benchmark do Sistema mede o desempenho do seu hardware e gera uma Pontuação do Sistema, uma média ponderada do desempenho de CPU, memória, disco e IA.

O projeto original mantém um leaderboard online da comunidade, onde é possível compartilhar resultados com uma Etiqueta de Montador (uma identidade como "Tactical-Llama-1234"). Nesta distribuição esse serviço fica **desligado por padrão**: a seção de compartilhamento não aparece e nenhum resultado sai do servidor. Quem administra o servidor pode religá-lo com a variável `BENCHMARK_LEADERBOARD_URL`.

Vá para o **[Benchmark do Sistema →](/settings/benchmark)** para rodar um.

### O que é o Canal de Acesso Antecipado?
O Canal de Acesso Antecipado permite receber versões candidatas (release candidates), com os recursos e melhorias mais recentes, antes que cheguem às versões estáveis. Você pode ativá-lo ou desativá-lo em **Configurações → Verificar Atualizações**. Essas versões podem ter bugs; se você prefere estabilidade, fique no canal estável.

---

## Solução de problemas

### Um recurso não carrega ou mostra uma página em branco

**Tente estes passos:**
1. Espere 30 segundos: alguns recursos demoram para iniciar
2. Recarregue a página (Ctrl+R ou Cmd+R)
3. Volte para a Central de Comando e tente de novo
4. Veja em Configurações → Sistema se o serviço está rodando
5. Tente reiniciar o serviço (Parar e depois Iniciar, no Depósito de Apps)

### Os mapas mostram uma área cinza ou em branco

O recurso de Mapas precisa de dados de mapa baixados. Se você vê uma área em branco:
1. Vá para **Configurações → Gerenciador de Mapas**
2. Baixe as regiões de mapa da sua área
3. Espere os downloads terminarem
4. Volte para os Mapas e recarregue a página

### ERROR: Failed to load the XML library file '/data/kiwix-library.xml'

Isso geralmente significa que o serviço da Biblioteca de Informação iniciou antes de o índice da biblioteca do Kiwix estar totalmente pronto.

Tente esta sequência de recuperação:
1. Vá para o **[Depósito de Apps](/supply-depot)**
2. Pare a **Biblioteca de Informação (Kiwix)**
3. Espere de 10 a 15 segundos e inicie de novo
4. Se o erro continuar, use **Forçar reinstalação** na Biblioteca de Informação, na mesma página

Depois que o reinício ou a reinstalação terminar, recarregue a página da Biblioteca de Informação.

### As respostas da IA estão lentas

A IA local exige bastante poder de processamento. Para melhorar a velocidade:
- **Adicione uma GPU**: uma GPU NVIDIA com o NVIDIA Container Toolkit pode deixar a IA 10 a 20 vezes mais rápida, ou mais
- feche outros aplicativos no servidor
- garanta uma boa refrigeração (o superaquecimento reduz o desempenho)
- considere usar um modelo de IA menor ou mais rápido, se houver

### Como ativo a aceleração por GPU para a IA?

O monolith-nomad detecta GPUs NVIDIA automaticamente quando o NVIDIA Container Toolkit está instalado no host. Para configurar a aceleração por GPU:

1. **Instale uma GPU NVIDIA** no servidor (se ainda não houver)
2. **Instale o NVIDIA Container Toolkit** no host, seguindo o [guia oficial de instalação](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)
3. **Reinstale o Assistente de IA**: vá ao [Depósito de Apps](/supply-depot), encontre o Assistente de IA e clique em **Forçar reinstalação**

O monolith-nomad detecta a GPU durante a instalação e configura a IA para usá-la automaticamente. Você verá "NVIDIA container runtime detected" no progresso da instalação.

**Dica:** rode um [Benchmark do Sistema](/settings/benchmark) antes e depois para ver a diferença. Sistemas com aceleração por GPU costumam chegar a mais de 100 tokens por segundo, contra 10 a 15 só com CPU.

### Adicionei ou troquei a GPU, mas a IA continua lenta

Quando você adiciona ou troca uma GPU, o monolith-nomad precisa reconfigurar o container da IA para usá-la:

1. Confirme que o **NVIDIA Container Toolkit** está instalado no host
2. Vá para o **[Depósito de Apps](/supply-depot)**
3. Encontre o **Assistente de IA** e clique em **Forçar reinstalação**

A reinstalação forçada recria o container da IA com o suporte a GPU ativado. Sem esse passo, a IA continua rodando só na CPU.

### Aparece um aviso de que o repasse da GPU não está funcionando

O monolith-nomad verifica se a GPU está de fato acessível dentro do container da IA. Se uma GPU é detectada no host mas não funciona dentro do container, aparece um aviso nas páginas de Informações do Sistema e de Configurações da IA. Clique no botão para reinstalar o Assistente de IA e recriar o container com acesso correto à GPU. Os modelos de IA já baixados são preservados.

### O chat de IA não está disponível

A página do chat de IA exige que o Assistente de IA esteja instalado:
1. Vá para o **[Depósito de Apps](/supply-depot)**
2. Instale o **Assistente de IA**
3. Espere a instalação terminar
4. O chat de IA fica acessível pela tela inicial ou pelo [Chat](/chat)

### O envio para a Base de Conhecimento travou

Se o envio de um documento parecer travado na Base de Conhecimento:
1. Confirme que o Assistente de IA está rodando em **Configurações → Depósito de Apps**
2. Documentos grandes demoram para ser processados: espere alguns minutos
3. Tente enviar um documento menor para verificar se o sistema está funcionando
4. Procure mensagens de erro em **Configurações → Sistema**

### Não consigo compartilhar o benchmark no leaderboard

Nesta distribuição o leaderboard da comunidade é um serviço do projeto original e fica **desligado por padrão**, então a opção de compartilhar não aparece. Se quem administra o servidor o religar (variável `BENCHMARK_LEADERBOARD_URL`), valem as regras do serviço:
- é preciso rodar um **Benchmark Completo** (não Só Sistema nem Só IA)
- o benchmark precisa incluir resultados de IA (o Assistente de IA precisa estar instalado e funcionando)
- a pontuação precisa ser maior que qualquer envio anterior do mesmo hardware

Se o envio falhar, confira os detalhes na mensagem de erro.

### "Serviço indisponível" ou erros de conexão

O serviço pode ainda estar iniciando. Espere de 1 a 2 minutos e tente de novo.

Se o problema continuar:
1. Vá para **Configurações → Depósito de Apps**
2. Encontre o serviço com problema
3. Clique em **Reiniciar**
4. Espere 30 segundos e tente de novo

### Os downloads estão travados ou falhando

1. Verifique a conexão com a internet
2. Vá para **Configurações** e veja o armazenamento disponível
3. Se o armazenamento estiver cheio, apague conteúdo que não usa
4. Cancele o download travado e tente de novo

Um download que falha com um mirror passa automaticamente para o próximo e retoma de onde parou. Se o arquivo baixado não bater com o SHA-256 publicado, ele é descartado e baixado de novo, nunca instalado.

### O servidor não inicia

Se você não consegue acessar a Central de Comando:
1. Confirme que o hardware do servidor está ligado
2. Verifique a conectividade de rede
3. Tente acessar diretamente pelo endereço IP do servidor
4. Confira os logs do servidor, se tiver acesso ao console

### Esqueci a minha senha do Kolibri

As senhas do Kolibri são gerenciadas à parte:
1. Se você é administrador, pode redefinir as senhas dos usuários no gerenciamento de usuários do Kolibri
2. Se esqueceu a senha de administrador, talvez precise redefini-la pela linha de comando (fale com o administrador do servidor)

---

## Atualizações e manutenção

### Como atualizo o monolith-nomad?
1. Vá para **Configurações → Verificar Atualizações**
2. Se houver uma atualização, clique para instalar
3. O sistema baixa as atualizações e reinicia automaticamente
4. Isso costuma levar de 2 a 5 minutos

As atualizações vêm das releases publicadas no repositório deste fork, não do projeto original.

### Devo atualizar com frequência?
Sim, enquanto tiver internet. As atualizações trazem:
- correções de bugs
- recursos novos
- melhorias de segurança
- melhorias de desempenho

### O monolith-nomad pode se atualizar sozinho?
Sim. O monolith-nomad pode manter o software, os apps instalados e o conteúdo em dia sozinho. As atualizações automáticas são **opcionais e vêm desligadas**: você liga o que quiser em **Configurações → Atualizações** (e, no caso dos apps, num interruptor em cada app no Depósito de Apps). Elas só rodam dentro de uma janela de horário que você escolhe, depois de verificações de segurança, e nunca aplicam saltos de versão principal automaticamente. Veja o passo a passo completo no **[guia de Atualizações](/docs/updates)**.

### Como atualizo o conteúdo (Wikipédia etc.)?
As atualizações de conteúdo são separadas das atualizações de software:
1. Vá para **Configurações → Gerenciador de Conteúdo** ou **Explorador de Conteúdo**
2. Veja se há versões mais novas do conteúdo instalado
3. Baixe as versões atualizadas conforme a necessidade

Você também pode ligar as **atualizações automáticas de conteúdo**, para que as bibliotecas Wikipédia/ZIM e as regiões de mapa instaladas se atualizem sozinhas durante a noite. Veja o [guia de Atualizações](/docs/updates).

Dica: novas cópias da Wikipédia saem mais ou menos uma vez por mês.

### O que acontece se uma atualização falhar?
O sistema foi feito para se recuperar sem traumas. Se uma atualização falhar:
1. A versão anterior deve continuar funcionando
2. Tente atualizar de novo mais tarde
3. Procure mensagens de erro em Configurações → Sistema

### Manutenção pela linha de comando

Para solução de problemas avançada, ou quando não for possível acessar a interface web, o monolith-nomad inclui scripts auxiliares em `/opt/project-nomad` (o caminho mantém o nome técnico original por compatibilidade):

**Iniciar todos os serviços:**
```bash
sudo bash /opt/project-nomad/start_nomad.sh
```

**Parar todos os serviços:**
```bash
sudo bash /opt/project-nomad/stop_nomad.sh
```

**Atualizar a Central de Comando:**
```bash
sudo bash /opt/project-nomad/update_nomad.sh
```
*Observação: isso atualiza só a Central de Comando, não os apps. Atualize os apps pela interface web.*

**Desinstalar o monolith-nomad:**
```bash
curl -fsSL https://github.com/jhonatanoliveira2/monolith-nomad/releases/latest/download/uninstall_nomad.sh -o uninstall_nomad.sh
sudo bash uninstall_nomad.sh
```
*Atenção: isso não pode ser desfeito. Todos os dados serão apagados.*

---

## Privacidade e segurança

### Meus dados são privados?
Sim. O monolith-nomad roda inteiramente no seu hardware. Suas buscas, conversas com a IA e dados de uso nunca saem do seu servidor.

Os serviços online do projeto original (leaderboard de benchmark, newsletter de notas de versão e lista curada de modelos de IA) ficam desligados por padrão nesta distribuição. O teste de conexão com a internet consulta só `1.1.1.1` e `api.github.com`.

### Outras pessoas podem acessar o meu servidor?
Por padrão, o monolith-nomad fica acessível na sua rede local. Qualquer pessoa na mesma rede consegue acessá-lo. Em redes públicas, considere medidas de segurança adicionais.

### A IA envia dados para algum lugar?
Não. A IA roda totalmente local. Suas conversas não são enviadas a nenhum serviço externo. O chat de IA é parte da Central de Comando, sem nenhum serviço separado para configurar.

---

## Onde conseguir mais ajuda

### A IA pode ajudar
Faça uma pergunta no [Chat de IA](/chat). A IA local responde perguntas sobre muitos assuntos, inclusive solução de problemas técnicos. Como a documentação do monolith-nomad fica na Base de Conhecimento, ela também ajuda com perguntas específicas do servidor.

### Consulte a documentação
Você já está nela. Use o menu para encontrar assuntos específicos.

### Relate um problema
Encontrou um bug ou quer sugerir algo? Abra uma issue nas **[GitHub Issues do monolith-nomad](https://github.com/jhonatanoliveira2/monolith-nomad/issues)**.

### Notas de versão
Veja o que mudou em cada versão: **[Notas de Versão](/docs/release-notes)**
