# Como manter o monolith-nomad atualizado

O monolith-nomad funciona melhor quando é mantido em dia enquanto você tem internet, para estar pronto com o software e o conteúdo mais recentes da próxima vez que você ficar offline. Esta página explica o que pode ser atualizado, como atualizar quando quiser e como deixar o monolith-nomad cuidar disso automaticamente.

---

## Os três tipos de atualização

Há três coisas diferentes que podem ser atualizadas, e você controla cada uma de forma independente:

1. **Software (o núcleo)**: o próprio monolith-nomad: a Central de Comando, recursos novos, correções de bugs e melhorias de segurança.
2. **Apps**: os apps instaláveis do [Depósito de Apps](/supply-depot) (Kiwix, o Assistente de IA e qualquer outro que você tenha adicionado).
3. **Conteúdo**: o seu material offline: a Wikipédia e outras bibliotecas do Kiwix, e as regiões de mapa baixadas.

Você pode atualizar qualquer um deles quando quiser, ou configurar qualquer um para atualizar automaticamente.

### De onde vêm as atualizações

- **Software:** das releases publicadas no repositório deste fork (`github.com/jhonatanoliveira2/monolith-nomad`) e das imagens em `ghcr.io/jhonatanoliveira2`. O servidor não busca atualizações do software no projeto original.
- **Apps:** cada app vem do registro de imagens do próprio autor (Kiwix, Ollama, Kolibri e outros).
- **Conteúdo:** os ZIMs vêm do catálogo do Kiwix, baixados com os downloads inteligentes: o servidor lê a lista oficial de mirrors, mede os mirrors antes de escolher, baixa com o aria2c e confere o SHA-256 publicado pelo `download.kiwix.org` antes de instalar. Um arquivo incompleto ou com hash diferente nunca é instalado. Os mapas regionais continuam vindo do repositório de mapas do projeto original.

---

## Atualizar quando quiser

Para verificar e instalar atualizações você mesmo:

1. Vá para **[Configurações → Verificar Atualizações](/settings/update)**.
2. Se houver uma atualização de software, clique para instalar. O monolith-nomad baixa a atualização e reinicia (geralmente de 2 a 5 minutos).
3. Os apps podem ser atualizados pelo cartão de cada um no [Depósito de Apps](/supply-depot), em **Gerenciar › Atualizar**.
4. O conteúdo é gerenciado em **Configurações → Gerenciador de Conteúdo** e no **Explorador de Conteúdo**, onde você pode baixar versões mais novas das bibliotecas e dos mapas instalados.

Se uma atualização de software ou de app falhar, o monolith-nomad foi feito para se recuperar sem traumas: a versão anterior, que funcionava, continua rodando, e o servidor continua no ar.

---

## Atualizações automáticas

O monolith-nomad pode se manter atualizado sem que você precise lembrar de verificar. **As atualizações automáticas são opcionais e vêm desligadas**: nada se atualiza sozinho até você ligar. Tudo é gerenciado em **Configurações → Atualizações**.

Algumas regras valem para os três tipos:

- **Você escolhe uma janela de horário.** As atualizações automáticas só rodam nas horas que você definir, para nunca interromper o uso.
- **Versões principais (major) nunca são automáticas.** Só as atualizações menores (minor) e de correção (patch) são aplicadas sozinhas; um salto de versão principal sempre espera você fazer manualmente, de propósito.
- **As verificações de segurança vêm primeiro.** Antes de aplicar qualquer coisa, o monolith-nomad confirma que há espaço em disco suficiente e que não há outra atualização, download ou instalação em andamento.
- **Estar offline não causa problema.** Se o monolith-nomad não conseguir acessar a internet para verificar, ele simplesmente pula aquela rodada e tenta de novo mais tarde.

### Atualizações automáticas do software (núcleo)

Ligue em **Configurações → Atualizações**. Com a opção ativa, o monolith-nomad atualiza o próprio núcleo para releases mais novas dentro da mesma versão principal, na janela escolhida, depois de um período de **espera** configurável (para que uma release recém-publicada tenha tempo de se provar antes de o seu servidor recebê-la). A mesma página mostra o interruptor, a janela, a configuração de espera e o estado em tempo real. Se as atualizações falharem repetidamente por um motivo real, o monolith-nomad desliga o recurso e avisa você, em vez de tentar para sempre.

### Atualizações automáticas dos apps

As atualizações automáticas dos apps são opcionais em **dois níveis**: um interruptor geral em **Configurações → Atualizações** *e* um interruptor em cada cartão de app no [Depósito de Apps](/supply-depot). Os dois precisam estar ligados para um app se atualizar sozinho. As atualizações de apps usam a mesma janela e a mesma espera do núcleo, aplicam só versões menores e de correção, e recuam automaticamente para qualquer app que continue falhando.

### Atualizações automáticas do conteúdo

As bibliotecas Wikipédia/ZIM e as regiões de mapa instaladas também podem se atualizar sozinhas. Como os downloads de conteúdo são grandes (muitas vezes vários gigabytes), as atualizações de conteúdo rodam numa **janela noturna própria**, com **limite de banda**, separada da programação do software e dos apps. O monolith-nomad consulta diretamente os catálogos do Kiwix e de mapas e, quando uma biblioteca da Wikipédia é substituída por uma versão mais nova, mantém a Base de Conhecimento da IA sincronizada automaticamente.

---

## Canal de Acesso Antecipado

Quer recursos novos antes de chegarem à versão estável? Ative o **Canal de Acesso Antecipado** na página [Verificar Atualizações](/settings/update) para receber versões candidatas (release candidates) publicadas neste fork. Essas versões podem ter arestas a aparar, e você pode voltar ao canal estável quando quiser.

---

## Antes de ficar offline

Seja qual for a sua escolha, o hábito que mais importa é simples: **atualize enquanto ainda tem internet.** Faça à mão ou deixe as atualizações automáticas cuidarem disso, mas garanta que o software e o conteúdo estejam em dia antes de ir para um lugar sem conexão. Quando estiver offline, você terá as últimas versões sincronizadas de tudo prontas para uso.

**[Verificar Atualizações →](/settings/update)** · **[Veja o que mudou em cada versão →](/docs/release-notes)**
