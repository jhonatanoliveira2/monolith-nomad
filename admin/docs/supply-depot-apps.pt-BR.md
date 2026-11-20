# Apps do Depósito

O Depósito de Apps é onde você instala apps extras no monolith-nomad, além das ferramentas integradas. Cada app roda no próprio container, no seu servidor, totalmente offline, e ganha um botão **Abrir** quando termina de instalar.

Esta página reúne o que você precisa saber para começar a usar cada app *especificamente no monolith-nomad*: se é preciso fazer login, quais são as credenciais padrão, onde ficam os seus arquivos e o que você precisa ter em mãos antes. Ela não ensina a usar os apps em si. Cada app é um projeto de código aberto independente, com documentação própria, e há um link para ela em cada seção.

Uma observação sobre logins: alguns destes apps têm contas próprias, separadas do monolith-nomad. Quando um app pede para entrar, indicamos as credenciais iniciais e se você deve trocá-las.

Os apps são de terceiros, e a interface de muitos deles está em inglês. Por isso, os nomes de botões e telas desses apps aparecem aqui como no próprio app.

---

## Gerenciando os apps

Cada app instalado ganha um menu **Gerenciar** no seu cartão. Por ele você pode:

- **Documentação**: ir direto para as notas de primeiros passos daquele app no monolith-nomad (as mesmas seções por app que estão abaixo).
- **Editar**: mudar as configurações do app: mapeamento de portas, volumes, variáveis de ambiente e limites de memória e CPU. Isso vale também para os apps selecionados, não só para os personalizados. Suas edições são mescladas à configuração existente do app, então ajustes avançados (como o acesso à GPU do Assistente de IA) são preservados, e um app editado deixa de ser sobrescrito pelas atualizações do catálogo.
- **Logs** e **Estatísticas**: abrir uma visão em tempo real da saída de log do app ou do uso atual de memória e CPU, útil quando algo não está funcionando direito.
- **Atualizar** e **Remover**: baixar a versão mais recente de um app ou removê-lo (com a opção de apagar também a imagem). Se o container novo de uma atualização não iniciar, o monolith-nomad volta automaticamente para a versão que funcionava.

**Qual versão está rodando:** cada cartão mostra a versão instalada ao lado do nome do app (por exemplo, `Kiwix · 3.7.0`). Quando há uma versão mais nova, aparece uma etiqueta laranja de **atualização disponível** no cartão, fácil de ver de relance.

**Links "Abrir" personalizados:** por padrão, o botão **Abrir** aponta para o app no próprio endereço do servidor. Se você usa um proxy reverso ou DNS local e prefere abrir um app num endereço mais amigável (por exemplo `https://jellyfin.myhomelab.net`), use **Gerenciar › Editar** para definir uma URL de abertura personalizada. O monolith-nomad guarda o link original, para você poder voltar a ele quando quiser, e a personalização se mantém nas atualizações.

**Atualizar os apps automaticamente:** os apps instalados podem se atualizar sozinhos. Isso é opcional em dois níveis, um interruptor geral em **Configurações → Atualizações** e um interruptor por app no Depósito de Apps, e só atualizações menores e de correção são aplicadas automaticamente (versões principais continuam sempre manuais). Veja os detalhes no [guia de Atualizações](/docs/updates).

---

## Traga o seu próprio app

Além do catálogo selecionado, o Depósito de Apps pode rodar **o seu próprio container Docker** como um app gerenciado, junto com o resto. Clique em **Adicionar um app personalizado** e informe:

- a **imagem** a baixar (por exemplo `ghcr.io/owner/app:1.2.3`),
- os **mapeamentos de portas**, **volumes**, **variáveis de ambiente** e **limites de memória e CPU** de que ele precisa.

Enquanto você preenche, o monolith-nomad faz uma verificação prévia em tempo real e avisa sobre coisas como conflitos de porta ou configurações arriscadas. Alguns avisos (um registro não confiável, ou uma tag `:latest`, cuja versão não pode ser acompanhada) são só recomendações, e você pode escolher **instalar mesmo assim**; configurações realmente inseguras são bloqueadas.

Depois de instalado, um app personalizado se comporta como qualquer outro: ganha o mesmo menu **Gerenciar** (Editar, Logs, Estatísticas, Atualizar, Remover), mostra a versão no cartão e pode ativar as atualizações automáticas. O monolith-nomad protege os volumes com caminhos do host e restringe os logs e as estatísticas aos containers que ele gerencia, então um app personalizado não alcança nada além do que você der a ele.

> Um app personalizado é exatamente isso: seu. O monolith-nomad o roda e não interfere; não há documentação de configuração nem suporte para software fora do catálogo selecionado. Consulte a documentação do próprio projeto para saber como usá-lo.

---

## Stirling PDF {% #stirling-pdf %}

Uma caixa de ferramentas completa para trabalhar com PDFs, toda no seu próprio hardware. Junte e divida arquivos, converta de e para PDF, comprima, gire, adicione ou remova senhas, aplique OCR em documentos digitalizados para torná-los pesquisáveis, assine, carimbe e oculte trechos. São mais de 50 ferramentas e, como tudo roda localmente, nenhum dos seus documentos sai do servidor.

**Site oficial:** [stirlingpdf.com](https://stirlingpdf.com) · **Código-fonte:** [github.com/Stirling-Tools/Stirling-PDF](https://github.com/Stirling-Tools/Stirling-PDF)

**Na primeira vez que você abrir:** ele abre direto nas ferramentas, sem login. O Stirling vem configurado para pular a tela de login, porque no monolith-nomad ele é uma ferramenta pessoal na sua própria rede, e uma barreira de senha só atrapalha. Você verá "Guest" no canto inferior esquerdo, o que é normal.

**Atenção, ele demora para iniciar:** o Stirling PDF é um aplicativo Java grande. Depois de instalar, espere de 30 a 60 segundos para ele terminar de iniciar antes de carregar direito. Ele também usa bastante memória (cerca de 1 GB), então se dá melhor num servidor com folga.

**Quer protegê-lo com senha?** Se você prefere que o Stirling peça login (por exemplo, se algumas pessoas compartilham o servidor e você quer este app protegido), pode religar o login pelo monolith-nomad:

1. Na página do Depósito de Apps, encontre o Stirling PDF e clique em **Gerenciar > Editar**.
2. Em **Variáveis de ambiente**, troque `SECURITY_ENABLELOGIN=false` por `SECURITY_ENABLELOGIN=true`.
3. Salve. O monolith-nomad recria o app, e a tela de login volta.

Na primeira vez que entrar depois disso, use o usuário `admin` e a senha `stirling`. O Stirling vai pedir que você defina a sua própria senha na hora. Esta é a única forma de religar o login: o menu de configurações do Stirling só abre para quem está logado, então, com o login desligado, você o liga pela tela Editar do monolith-nomad, não de dentro do Stirling.

**Seus dados:** as configurações ficam na pasta `storage/stirling-pdf` do servidor. Os PDFs em que você trabalha são enviados para a operação e baixados de volta para o seu dispositivo. O Stirling não é um acervo de longo prazo, então ele não guarda os seus documentos.

**De onde vêm os PDFs (e por que você não vê os arquivos do servidor):** o Stirling trabalha com arquivos do dispositivo que você está usando, seja notebook, celular ou tablet. Você clica em "Open from computer", escolhe um PDF, trabalha nele e baixa o resultado de volta para esse dispositivo. O Stirling não alcança arquivos guardados em outros lugares do servidor, então não mostra a sua pasta de livros, os documentos da Base de Conhecimento nem nada que esteja no File Browser. Se o PDF que você quer já está no servidor, baixe-o primeiro de onde ele estiver (pelo File Browser, por exemplo) e abra essa cópia no Stirling. É um passo a mais, mas é também por isso que os seus arquivos ficam exatamente onde você os colocou, em vez de serem puxados para outro app.

**Funciona offline:** todas as ferramentas de PDF rodam localmente, então a caixa de ferramentas funciona totalmente offline. Alguns recursos secundários acessam a internet e não fazem nada sem conexão: a opção de importar do "Google Drive" e os links do rodapé (Survey, Discord, GitHub). Nenhum deles importa para trabalhar com PDFs. O único recurso principal com uma parte online é o OCR, que lê o texto de páginas digitalizadas: ele já vem com o inglês instalado, e só adicionar outros idiomas exige conexão.

## File Browser {% #file-browser %}

Um gerenciador de arquivos web para o seu servidor. Navegue por pastas, envie e baixe arquivos, crie pastas, renomeie, mova e apague, tudo pelo navegador, sem instalar nada no computador. É um jeito prático de colocar e tirar arquivos do servidor ou organizar as coisas sem precisar da linha de comando.

**Site oficial:** [filebrowser.org](https://filebrowser.org) · **Código-fonte:** [github.com/filebrowser/filebrowser](https://github.com/filebrowser/filebrowser)

**Na primeira vez que você abrir:** aparece uma tela de login. Entre com o usuário `admin` e a senha `nomad`. **Troque essa senha imediatamente.** Ela é a mesma em todas as instalações, então, até você trocá-la, qualquer pessoa na sua rede que a conheça pode entrar. Clique na engrenagem de configurações, abra as configurações do seu perfil e defina uma senha nova.

Ao contrário da maioria dos apps daqui, o File Browser mantém o login de propósito. Ele consegue renomear e apagar arquivos reais do servidor, então uma senha é a escolha certa mesmo na sua própria rede.

**O que você vê:** o File Browser mostra as pastas de conteúdo do servidor num só lugar:

- **books** - e-books, incluindo o que você quiser que o Calibre-Web leia
- **maps** - dados de mapa baixados
- **media** - vídeos, músicas e fotos, incluindo o que você quiser que o Jellyfin sirva
- **zim** - conteúdo offline baixado, como a Wikipédia e outras bibliotecas de referência
- **kb_uploads** - documentos que você adicionou à Base de Conhecimento

Você pode enviar, baixar, renomear, mover e apagar dentro delas, e o que você colocar no nível de cima também fica salvo. As pastas internas em que os apps realmente rodam (como os modelos de IA, o índice de busca e o cofre de senhas) ficam de fora do File Browser de propósito, para você não navegar nelas nem apagá-las por engano.

> **Sobre apagar:** o que você apaga aqui some de verdade, não há lixeira. A maior parte do conteúdo pode ser recuperada (dá para baixar de novo um mapa ou uma biblioteca da Wikipédia), mas, se você apagar um livro ou um vídeo que você mesmo adicionou, essa cópia já era. Apague com o mesmo cuidado que teria no seu próprio computador.

**Funciona offline:** totalmente. O File Browser roda inteiramente no servidor e não acessa a internet para nada, então funciona do mesmo jeito com ou sem conexão.

## Calibre-Web {% #calibre-web %}

Um leitor e gerenciador web para a sua coleção de e-books. Leia livros direto no navegador, organize-os por autor, série e etiquetas, e envie-os para um Kindle ou outro leitor digital. Ele usa a pasta de livros do servidor, então toda a sua biblioteca fica no dispositivo e vai aonde ele for.

**Site oficial:** [github.com/janeczku/calibre-web](https://github.com/janeczku/calibre-web)

**Na primeira vez que você abrir:** o Calibre-Web precisa de uma biblioteca para usar, e o monolith-nomad cria uma vazia durante a instalação, para você não travar num erro de configuração. A configuração é feita uma vez só:

1. Abra o Calibre-Web. Ele abre numa tela **Database Configuration**.
2. No campo **Location of Calibre Database**, digite `/books` e clique em **Save**. Você verá "Database Settings updated", e a sua biblioteca (vazia) abre.
3. Pronto. A biblioteca está pronta para receber livros.

Se ele pedir login em algum momento, o padrão é `admin` / `admin123`. **Troque essa senha** depois de entrar (clique em `admin`, no canto superior direito, e depois em Edit). Ela é a mesma em todas as instalações.

**Adicionar livros:** o envio pela página web vem desligado. Para ligá-lo, vá em **Admin** (canto superior direito) e edite a configuração básica para permitir envios; aí aparece um botão Upload. Você também pode colocar arquivos de e-book direto na pasta de livros pelo File Browser e usar a função "scan" do Calibre-Web para encontrá-los.

**Seus dados:** a biblioteca fica na pasta `books` do servidor (a mesma `books` que aparece no File Browser). Todo livro adicionado é guardado ali, então fazer backup dessa pasta faz backup da coleção inteira.

**Funciona offline:** ler e gerenciar a biblioteca funciona totalmente offline. O único recurso que acessa a internet é o "fetch metadata", que busca capas e descrições de livros em fontes online. Essa parte não faz nada offline, mas não afeta a leitura nem a organização dos livros que você já tem.

## IT Tools {% #it-tools %}

Uma coleção de mais de 100 pequenos utilitários que você normalmente procuraria na internet: geradores de hash, codificadores base64 e de URL, formatadores de JSON e SQL, geradores de UUID, um criador de QR code, conversores de cor e muito mais. Tudo roda localmente no servidor, então dá para usar sem internet.

**Site oficial:** [it-tools.tech](https://it-tools.tech) · **Código-fonte:** [github.com/CorentinTh/it-tools](https://github.com/CorentinTh/it-tools)

**Na primeira vez que você abrir:** ele abre direto nas ferramentas. Sem login, sem conta, sem configuração. Escolha uma ferramenta na barra lateral e use.

**Seus dados:** não há nada a gerenciar. O IT Tools não guarda nada no servidor entre as sessões, então não há arquivos, biblioteca para configurar nem credenciais para guardar. É o app mais simples do Depósito de Apps.

**Funciona offline:** todas as ferramentas rodam direto no navegador, a partir da cópia do servidor. Nada aqui acessa a internet, então tudo continua funcionando offline.

## Excalidraw {% #excalidraw %}

Um quadro branco virtual para diagramas e esboços rápidos, com cara de desenho à mão. Desenhe caixas, setas e formas livres, coloque textos e imagens, e monte um fluxograma, um diagrama de rede ou uma ideia rascunhada em segundos. Tudo tem um visual simpático de rabisco em guardanapo e roda direto no navegador.

**Site oficial:** [excalidraw.com](https://excalidraw.com) · **Código-fonte:** [github.com/excalidraw/excalidraw](https://github.com/excalidraw/excalidraw)

**Na primeira vez que você abrir:** ele abre direto numa tela em branco. Sem login, sem conta, sem configuração. Escolha uma forma na barra de ferramentas e comece a desenhar. Aparece uma breve mensagem de boas-vindas lembrando que o seu trabalho fica salvo no navegador, o que leva à única coisa que vale a pena entender sobre o Excalidraw no monolith-nomad.

**Onde ficam os seus desenhos (leia esta parte):** esta versão do Excalidraw não tem armazenamento no servidor. O desenho fica salvo dentro do navegador que você está usando, naquele dispositivo. Daí decorrem algumas coisas:

- O desenho **não é compartilhado entre dispositivos**. O que você desenha no notebook não aparece quando você abre o Excalidraw no celular, porque cada navegador guarda a sua própria cópia.
- Se você **limpar os dados do navegador**, ou usar uma janela privada/anônima, o desenho some. Não há cópia no servidor para recuperar.
- Por isso, **salve o seu trabalho num arquivo.** Use o menu (canto superior esquerdo) para **Save to...** um arquivo `.excalidraw` e guarde-o num lugar seguro, por exemplo na sua pasta de mídia ou de documentos pelo File Browser. Para retomar depois, use **Open** e carregue esse arquivo. Esta é a única forma de guardar um desenho a longo prazo ou levá-lo para outro dispositivo.

**Seus dados:** como tudo fica no navegador, não há pastas nem credenciais do servidor a gerenciar para o Excalidraw. Os arquivos que você salva ficam onde você escolher.

**Funciona offline:** o quadro branco em si funciona offline: você desenha, edita e salva arquivos sem internet. Três coisas para saber:

- **A fonte característica de desenho à mão vem da internet.** Quando o servidor está offline, o Excalidraw não consegue buscá-la e usa uma fonte simples, então os diagramas ficam com menos cara de rabisco. Os desenhos em si não são afetados; só a fonte na tela muda.
- **O Excalidraw envia estatísticas de uso anônimas quando o servidor está online.** Os criadores do app incluem um rastreamento básico de visualizações de página (por um serviço chamado Simple Analytics) que registra que o app foi aberto. Ele não vê os seus desenhos e não alcança nada quando o servidor está offline, mas é bom você saber que ele existe, já que o resto do monolith-nomad é feito para não falar com ninguém de fora.
- **Alguns botões são recursos de nuvem que não funcionam aqui.** "Live collaboration", "Sign up" e "Excalidraw+" apontam para o serviço online pago dos criadores e precisam de internet. Eles não fazem parte do seu quadro branco offline, então pode ignorá-los. O mesmo vale para o navegador de formas **Library**, que busca de uma galeria online.

## Homebox {% #homebox %}

Um sistema de inventário doméstico para acompanhar tudo o que você tem. Organize os seus pertences por locais e etiquetas, anexe fotos, registre números de série, preços de compra, datas de garantia e notas fiscais, e encontre qualquer coisa pela busca. É uma ferramenta muito útil para registros de seguro, controle de garantias e para saber o que você tem e onde está.

**Site oficial:** [homebox.software](https://homebox.software) · **Código-fonte:** [github.com/sysadminsmedia/homebox](https://github.com/sysadminsmedia/homebox)

**Na primeira vez que você abrir:** o Homebox abre numa tela de login, mas você ainda não tem conta, então precisa criar uma. Clique em **Register** e preencha:

- **o seu e-mail** (usado como nome de usuário para entrar),
- **o seu nome**,
- **uma senha** (o Homebox mostra um medidor de força e só deixa registrar quando a senha é forte o bastante, então use uma senha de verdade).

Clique em **Register** e entre com esse e-mail e essa senha. A primeira conta criada é a **dona** deste Homebox. Não há credenciais padrão para trocar: a conta é sua desde o início.

**Compartilha o servidor com outras pessoas?** Por padrão, o Homebox deixa qualquer pessoa que o alcance criar a própria conta. Tudo bem se for só você, ou se você confia em todos na sua rede. Se preferir bloquear novos registros depois de criar a sua conta:

1. Crie primeiro a sua conta de dono (acima).
2. Na página do Depósito de Apps, encontre o Homebox e clique em **Gerenciar > Editar**.
3. Em **Variáveis de ambiente**, adicione `HBOX_OPTIONS_ALLOW_REGISTRATION=false`.
4. Salve. O monolith-nomad recria o app, e o botão Register deixa de criar contas novas. Você continua entrando normalmente.

**Seus dados:** tudo o que o Homebox guarda fica numa única pasta do servidor, `storage/homebox`, num só arquivo de banco de dados (mais as fotos e notas fiscais que você anexar). Fazer backup dessa pasta faz backup do inventário inteiro.

**Funciona offline:** totalmente. O Homebox roda inteiramente no servidor, guarda todos os dados localmente e não tem rastreamento de uso, então funciona igual com ou sem conexão. Os links do cabeçalho (GitHub, Discord, o site do projeto) precisam de internet, mas são só atalhos para as páginas do projeto e não têm nada a ver com o seu inventário.

## Vaultwarden {% #vaultwarden %}

Um gerenciador de senhas privado que roda no seu próprio servidor. Ele é compatível com o Bitwarden, então você pode guardar logins, notas seguras e dados de cartões num cofre criptografado, e acessá-lo pelas extensões de navegador e apps de celular oficiais do Bitwarden, todos apontando para o seu servidor em vez da nuvem de outra pessoa.

**Site oficial:** [bitwarden.com](https://bitwarden.com) (para os apps e extensões) · **Código-fonte:** [github.com/dani-garcia/vaultwarden](https://github.com/dani-garcia/vaultwarden)

**Na primeira vez que você abrir, aparece um aviso de segurança. Isso é esperado, e o motivo é este:** um gerenciador de senhas só funciona por uma conexão segura (HTTPS), então o monolith-nomad configura o Vaultwarden com HTTPS automaticamente. Como o servidor é um dispositivo privado seu, e não um site público, ele usa um certificado autoassinado, e os navegadores mostram um aviso na primeira vez que o veem. Parece alarmante, mas é normal para um dispositivo na sua própria rede. Para passar por ele uma vez:

1. Clique em **Abrir** no cartão do Vaultwarden. O navegador mostra algo como *"Sua conexão não é particular"* ou *"Não seguro"*.
2. Clique em **Avançado** e depois em **Ir para (endereço do servidor)**. (Em alguns navegadores o botão se chama "Continuar" ou "Aceitar o risco".)
3. Você chega ao cofre do Vaultwarden. O navegador lembra a sua escolha, então o aviso não aparece de novo naquele dispositivo.

**Criar o seu cofre:** na página de login, clique em **Create account** e defina o seu **e-mail** e uma **senha mestra**.

> **A sua senha mestra não pode ser recuperada.** O Vaultwarden não tem e-mail de "esqueci a senha" nem redefinição, de propósito, porque ele nunca vê a sua senha. Se você esquecê-la, o cofre e tudo o que há nele ficam trancados para sempre. Escolha uma senha forte que você não vá perder, e considere anotá-la num lugar fisicamente seguro.

**Compartilha o servidor com outras pessoas?** Por padrão, qualquer pessoa que alcance o Vaultwarden pode criar a própria conta (cada conta é separada e criptografada). Se preferir que ninguém mais se cadastre depois que você criar a sua:

1. Crie primeiro a sua conta.
2. Na página do Depósito de Apps, encontre o Vaultwarden e clique em **Gerenciar > Editar**.
3. Em **Variáveis de ambiente**, adicione `SIGNUPS_ALLOWED=false`.
4. Salve. O monolith-nomad recria o app e os novos cadastros ficam desligados; as contas existentes continuam funcionando.

**Usar pelo celular e pelo navegador:** instale o app ou a extensão oficial do Bitwarden e, na tela de login, escolha **self-hosted** (ou "Server URL") e informe `https://(endereço do servidor):8480`. Alguns apps de celular são mais rígidos com certificados autoassinados e podem se recusar a conectar; o cofre web que você abre pelo monolith-nomad sempre funciona.

**Seus dados:** o cofre criptografado fica na pasta `storage/vaultwarden` do servidor. Fazer backup dessa pasta faz backup de tudo. (O painel de administração integrado fica desligado, a menos que você defina um token de administrador, o que a maioria das pessoas não precisa.)

**Funciona offline:** totalmente offline e privado. O Vaultwarden roda inteiramente no servidor, guarda o cofre localmente e não se comunica com ninguém. Os apps e extensões do Bitwarden também mantêm uma cópia local do cofre, então conseguem ler as suas senhas mesmo quando o servidor ou o celular estão offline.

## Jellyfin {% #jellyfin %}

O seu próprio servidor de mídia. Aponte o Jellyfin para uma pasta de filmes, séries, músicas e fotos no servidor, e ele organiza tudo com capas e detalhes e transmite para um navegador, celular, tablet, smart TV ou para os apps do Jellyfin. É uma alternativa privada e offline aos grandes serviços de streaming, para mídias que você já tem.

**Site oficial:** [jellyfin.org](https://jellyfin.org) · **Código-fonte:** [github.com/jellyfin/jellyfin](https://github.com/jellyfin/jellyfin)

**Na primeira vez que você abrir, há um assistente de configuração.** São algumas telas rápidas:

1. **Idioma** - escolha o idioma de exibição e clique em Next.
2. **Crie a conta de administrador** - informe um nome de usuário e uma senha. Esta é a conta principal, que controla o servidor, então use uma senha de verdade e guarde-a. (Depois você pode adicionar mais usuários pelo Dashboard, inclusive usuários limitados para crianças.)
3. **Adicione a sua mídia** - clique em **Add Media Library** e escolha um tipo de conteúdo. Para facilitar, o monolith-nomad já criou uma pasta correspondente a cada tipo dentro da sua pasta de mídia, então basta apontar cada biblioteca para a pasta certa:
   - biblioteca **Movies** → a pasta `Movies`
   - biblioteca **Shows** → a pasta `TV Shows`
   - biblioteca **Music** → a pasta `Music`
   - biblioteca **Photos** → a pasta `Photos`

   **Aponte cada biblioteca para a sua própria pasta, não para a pasta `media` inteira.** Isso importa: se você apontar uma biblioteca para a própria `media` (que contém todas as outras) e outra biblioteca para, digamos, `Music` dentro dela, o Jellyfin vê os mesmos arquivos reivindicados duas vezes, acusa um "duplicate path", e as suas músicas simplesmente não aparecem. Uma pasta por biblioteca mantém tudo organizado e funcionando. Você também pode pular esta etapa e adicionar as bibliotecas depois, pelo Dashboard.
4. **Metadados, acesso remoto, concluir** - aceite os padrões nas telas restantes e conclua. Depois entre com a conta que acabou de criar.

**Como colocar a sua mídia:** coloque os arquivos na subpasta correspondente da pasta **media** do servidor (a mesma `media` que aparece no File Browser): filmes em **Movies**, séries em **TV Shows**, músicas em **Music** (uma pasta por álbum funciona muito bem), fotos em **Photos**. O fluxo mais fácil é enviar os arquivos pelo File Browser (ou colocá-los como preferir) e, no Jellyfin, clicar em **Scan Library** para encontrá-los. O Jellyfin lê subpastas, então uma pasta de álbum inteira colocada em **Music** entra como um álbum. Ele também funciona melhor com arquivos bem nomeados (por exemplo `Nome do Filme (2020).mp4`), o que ajuda a encontrar as capas e os detalhes certos.

**Seus dados:** a sua mídia fica em `storage/media`. As configurações do Jellyfin, as contas de usuário e as capas que ele baixa ficam em `storage/jellyfin`. Os seus arquivos de mídia nunca são modificados; o Jellyfin só os lê.

**Funciona offline:** transmitir a sua própria mídia funciona totalmente offline, e essa é justamente a ideia. A única parte que usa a internet é a **busca de metadados**: quando o Jellyfin adiciona um filme ou série, ele tenta baixar capa, sinopse e elenco de bancos de dados online. Offline isso não é possível, então os itens aparecem com nomes simples e sem capa, mas tocam perfeitamente. Quando a conexão voltar, uma varredura da biblioteca preenche as capas que faltam.

> **Sobre o desempenho da reprodução:** o Jellyfin reproduz a maioria dos arquivos sem esforço, mas, se o formato de um vídeo não é suportado pelo seu dispositivo, ele precisa convertê-lo na hora ("transcodificação"), o que é um trabalho pesado para o processador. O monolith-nomad não configura aceleração por placa de vídeo para isso por padrão, então vídeos muito grandes ou de alta resolução podem travar num servidor modesto. Usar arquivos num formato amplamente suportado (como MP4/H.264) evita a transcodificação e garante a reprodução mais suave.

## Meshtastic Web {% #meshtastic-web %}

Um painel de controle no navegador para dispositivos [Meshtastic](https://meshtastic.org). O Meshtastic é uma forma de troca de mensagens por rádio de longo alcance, fora da rede: rádios LoRa pequenos e baratos formam a própria rede em malha e enviam mensagens de texto e localizações GPS por quilômetros, sem sinal de celular, sem internet e sem mensalidade. Este app é como você configura esses rádios e lê e envia mensagens numa tela grande.

**Site oficial:** [meshtastic.org](https://meshtastic.org) · **Código-fonte:** [github.com/meshtastic/web](https://github.com/meshtastic/web)

**Você precisa de um rádio Meshtastic para usar isto.** Este app é só o painel de controle. Sozinho, ele abre numa tela "No devices connected", porque o trabalho de verdade acontece num dispositivo Meshtastic físico (e na rede de outros rádios com que ele fala). Se você ainda não tem um, o app não faz muita coisa.

**Na primeira vez que você abrir:** ele abre direto, sem login. Clique em **New Connection** e você verá três formas de conectar ao rádio:

- **HTTP** - conecta a um rádio que já está na sua rede Wi-Fi, digitando o endereço IP dele. **Este é o método a usar no monolith-nomad** (veja abaixo).
- **Bluetooth** - pareia com um rádio próximo por Bluetooth.
- **Serial** - conecta a um rádio ligado numa porta USB.

**A pegadinha específica do monolith-nomad (Bluetooth e Serial precisam de HTTPS):** os navegadores só deixam um site usar Bluetooth ou USB quando a página é carregada por uma conexão segura (HTTPS). O monolith-nomad serve o Meshtastic Web por HTTP simples, então aqui as **opções Bluetooth e Serial não conectam**: o navegador as bloqueia. A que funciona é a **HTTP**: coloque o rádio Meshtastic na mesma rede Wi-Fi (os rádios Meshtastic podem entrar no Wi-Fi) e conecte-se a ele por aqui, pelo endereço IP. Se você precisa mesmo parear por USB ou Bluetooth, faça isso pelo app oficial do Meshtastic no celular ou pelo site do Meshtastic.

**Seus dados:** não há nada a configurar nem a guardar no servidor para este app. As configurações do rádio ficam no próprio rádio, e as preferências do app ficam no seu navegador. Não há pasta do servidor a gerenciar.

**Funciona offline:** totalmente offline, que é a razão de ser do Meshtastic. O app é servido pelo seu servidor, e a comunicação com os rádios acontece pela rede local ou pelo rádio, nunca pela internet. As únicas partes online são os links do rodapé (Vercel, avisos legais), que não importam para usar a sua rede em malha.

## Plataforma de Educação (Kolibri) {% #kolibri %}

Uma plataforma de aprendizagem offline completa, da Learning Equality. O Kolibri reúne videoaulas, exercícios e leituras em canais estruturados, organiza tudo em turmas e aulas, acompanha o progresso dos alunos e funciona inteiramente no servidor, sem internet. Ele foi feito para escolas e alunos em lugares com pouca ou nenhuma conectividade.

**Site oficial:** [learningequality.org/kolibri](https://learningequality.org/kolibri) · **Código-fonte:** [github.com/learningequality/kolibri](https://github.com/learningequality/kolibri)

**Na primeira vez que você abrir, há um assistente de configuração rápido.** Escolha o tipo de instituição e crie a **conta de administrador** (o superusuário que gerencia o dispositivo inteiro, então use uma senha de verdade e guarde-a). Depois de entrar, você importa o conteúdo de aprendizagem na forma de **canais**.

**Importar conteúdo:** o conteúdo do Kolibri vem em canais que você importa. Abra **Device → Channels → Import** e traga canais do Kolibri Studio (online) ou importe de um disco local ou de outro dispositivo Kolibri, se você já tiver os arquivos. Há muito conteúdo disponível, então importe só os canais de que precisa; eles podem ser grandes.

**Migrar o conteúdo da Plataforma de Educação (Gen 1):** versões anteriores do projeto traziam um Kolibri bem mais antigo (a imagem `treehouses/kolibri:0.12.8`). A Plataforma de Educação "Gen 2" é um Kolibri mais novo, oficial do projeto Kolibri, e instala **do zero**: os canais e os dados de alunos antigos **não** são trazidos automaticamente, porque as duas versões guardam os dados de formas diferentes demais para uma migração segura. Se você usava a antiga e quer importar os canais existentes para a nova, o processo é este:

1. Instale a "Education Platform (Gen 2)" pelo catálogo (ela roda ao lado da antiga, numa porta diferente, então nada é interrompido enquanto você a configura).
2. Abra a nova, passe pelo assistente de configuração e, no menu lateral, vá para **Device > Channels > Import**. Escolha a opção "Local network or internet" e depois "Add new device". Na janela que aparece, informe o endereço IP do seu servidor com a porta da Plataforma de Educação antiga (8300 por padrão, por exemplo `http://192.168.1.36:8300`), dê um nome (o que quiser), clique em "Add" e depois em "Continue".
3. Agora você pode selecionar canais individuais da Plataforma de Educação antiga, ou escolher "Select entire channels instead" para importar tudo de uma vez. Clique em "Import" quando estiver pronto, e a transferência começa.
4. Quando estiver satisfeito com a instalação nova e tiver copiado o conteúdo que quiser, desinstale a Plataforma de Educação antiga pelo cartão dela (que tem a etiqueta **legado**). É recomendável escolher remover também a imagem e o volume de dados antigos ao desinstalar, para evitar confusão e liberar espaço, mas, se quiser mantê-la por um tempo por precaução, tudo bem também.

**Seus dados:** os canais importados, as turmas e o progresso dos alunos ficam na pasta `storage/kolibri-gen2` do servidor. Fazer backup dessa pasta faz backup do seu Kolibri inteiro.

**Funciona offline:** totalmente offline depois que o conteúdo é importado; é para isso que o Kolibri existe. A única etapa que usa a internet é importar canais do Kolibri Studio; tudo o que vem depois, navegar pelas aulas, fazer exercícios e acompanhar o progresso, roda inteiramente no servidor.

## MeshCore Web {% #meshcore-web %}

Um cliente no navegador para rádios [MeshCore](https://meshcore.io). O MeshCore é outra abordagem para a troca de mensagens por rádio LoRa em malha, de longo alcance e fora da rede, uma irmã do Meshtastic: rádios pequenos formam a própria rede e transmitem texto e localização por quilômetros, sem sinal de celular, sem internet e sem mensalidade. Este app é como você configura um rádio MeshCore e lê e envia mensagens numa tela grande. Se você ainda não usa equipamento MeshCore, o cliente Meshtastic acima é o ponto de partida mais comum. Este aqui é para quem usa MeshCore.

**Site oficial:** [meshcore.io](https://meshcore.io) · **Código-fonte:** [github.com/aXistem-dev/meshcore-web](https://github.com/aXistem-dev/meshcore-web) (uma versão empacotada do cliente MeshCore de Liam Cottle)

**Você precisa de um rádio MeshCore para usar isto.** Como o cliente Meshtastic, este é só o painel de controle. Sem um rádio conectado, ele não tem com o que conversar.

**Na primeira vez que você abrir, aparece um aviso de segurança. Isso é esperado, e o motivo é este:** o MeshCore se conecta ao rádio por USB ou Bluetooth, e os navegadores só deixam uma página usar USB ou Bluetooth quando ela é carregada por uma conexão segura (HTTPS). Por isso o monolith-nomad serve este app por HTTPS e, como o seu servidor é um dispositivo privado sem endereço público na web, usa um certificado autoassinado, que os navegadores alertam na primeira vez que o veem. Para passar por ele uma vez:

1. Clique em **Abrir** no cartão do MeshCore Web. O navegador mostra algo como *"Sua conexão não é particular"* ou *"Não seguro"*.
2. Clique em **Avançado** e depois em **Ir para (endereço do servidor)**. (Em alguns navegadores o botão se chama "Continuar" ou "Aceitar o risco".)
3. Você chega ao MeshCore Web. O navegador lembra a sua escolha, então o aviso não aparece de novo naquele dispositivo.

**Conectar o rádio:** use o **Chrome ou o Edge**, que têm o melhor suporte a USB e Bluetooth no navegador. Ligue o rádio no computador em que você está navegando (USB), ou deixe-o por perto (Bluetooth), e conecte-se a ele de dentro do app. O rádio se conecta **ao computador que você está usando**, não ao servidor, então conecte a partir de um dispositivo com o rádio ligado ou ao alcance do Bluetooth. Alguns celulares são mais rígidos com certificados autoassinados e podem se recusar a conectar; um Chrome ou Edge no computador é o mais confiável.

**Seus dados:** não há nada a configurar nem a guardar no servidor para este app. As configurações do rádio ficam no próprio rádio, e as preferências do app ficam no seu navegador. Não há pasta do servidor a gerenciar.

**Funciona offline:** totalmente offline, que é a razão de ser do MeshCore. O app é servido pelo seu servidor e fala com o rádio diretamente por USB ou Bluetooth, nunca pela internet.

## Biblioteca Traduzida {% #offline-translation %}

Lê a Biblioteca de Informação em outro idioma. Abra um artigo e aparece, no topo, uma barra **Translate this page** com um botão para cada idioma instalado, mais **Original** para voltar. A sua escolha se mantém enquanto você navega por outros artigos.

**Por que usar isto em vez do Assistente de IA:** o Assistente de IA consegue traduzir, mas isto é cerca de 1.600 vezes mais rápido na mesma máquina e não precisa de placa de vídeo, então funciona em qualquer servidor. Também é mais cuidadoso com nomes: ao traduzir uma página, o Assistente de IA traduz sem cerimônia um nome como "monolith-nomad" para outro idioma, e isto não.

**Escolher os idiomas:** francês, espanhol e alemão vêm configurados por padrão. Para adicionar ou remover idiomas:

1. No **Depósito de Apps**, abra o menu **Gerenciar** da Biblioteca Traduzida e escolha **Editar**.
2. Em **Variáveis de ambiente**, encontre `TRANSLATE_LANGS=fr,es,de`.
3. Altere a lista de códigos de idioma, separados por vírgulas. Por exemplo, `TRANSLATE_LANGS=fr,es,de,sv` adiciona o sueco.
4. Clique em **Salvar**. O app reinicia, baixa os idiomas novos e acrescenta um botão para cada um na barra **Translate this page**.

Adicionar um idioma exige conexão com a internet, e cada um ocupa entre cerca de 45 MB e 140 MB em disco. Os idiomas que você já tem continuam funcionando offline. Tirar um código da lista não remove um idioma já baixado: ele continua em `storage/translate/models` e mantém o seu botão.

Estes são os 50 idiomas disponíveis. O chinês ainda não está disponível.

| Idioma | Código |
|---|---|
| Africâner | `af` |
| Árabe | `ar` |
| Basco | `eu` |
| Bengali | `bn` |
| Bósnio | `bs` |
| Búlgaro | `bg` |
| Catalão | `ca` |
| Croata | `hr` |
| Tcheco | `cs` |
| Dinamarquês | `da` |
| Holandês | `nl` |
| Estoniano | `et` |
| Finlandês | `fi` |
| Francês | `fr` |
| Galego | `gl` |
| Alemão | `de` |
| Grego | `el` |
| Guzerate | `gu` |
| Hebraico | `he` |
| Híndi | `hi` |
| Húngaro | `hu` |
| Islandês | `is` |
| Indonésio | `id` |
| Italiano | `it` |
| Japonês | `ja` |
| Canarês | `kn` |
| Coreano | `ko` |
| Letão | `lv` |
| Lituano | `lt` |
| Malaio | `ms` |
| Malaiala | `ml` |
| Marati | `mr` |
| Norueguês | `nb` |
| Persa | `fa` |
| Polonês | `pl` |
| Português | `pt` |
| Romeno | `ro` |
| Russo | `ru` |
| Sérvio | `sr` |
| Eslovaco | `sk` |
| Esloveno | `sl` |
| Espanhol | `es` |
| Sueco | `sv` |
| Tâmil | `ta` |
| Telugo | `te` |
| Tailandês | `th` |
| Turco | `tr` |
| Ucraniano | `uk` |
| Urdu | `ur` |
| Vietnamita | `vi` |

**A primeira inicialização precisa de internet.** Os modelos de idioma são baixados quando o app roda pela primeira vez, como na instalação de qualquer outro app. Depois disso, tudo é offline. Se você instalar sem conexão, o app ainda inicia e a biblioteca continua funcionando, só que sem tradução até ele conseguir baixar os modelos.

**O que não é traduzido:** tabelas e quadros informativos, o título da página na aba do navegador e os resultados de busca do próprio Kiwix. A busca também continua usando o idioma original, então pesquise no idioma do conteúdo (em geral, inglês) e traduza o artigo em que você chegar.

**Sobre os dois botões de idioma:** a barra de ferramentas da própria biblioteca tem um globo que muda os *menus* em volta da página. A barra que este app acrescenta muda o *artigo*. São coisas diferentes e ficam perto uma da outra, o que é infeliz, mas não é algo que dê para mudar de lugar.

**Precisão:** é tradução automática, e literal. Ela é muito boa para entender o sentido de um artigo. Tome cuidado ao confiar nela para termos médicos ou de segurança exatos, em que o termo correto em outro idioma muitas vezes não é o literal.

**Seus dados:** os modelos de idioma ficam em `storage/translate/models`. Nada do que você lê é guardado ou enviado para lugar nenhum.

**Funciona offline:** sim, depois que os modelos forem baixados.
