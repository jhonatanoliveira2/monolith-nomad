# Apps do Depósito

Cada app roda no próprio container, no seu servidor, e ganha um botão **Abrir** ao terminar a instalação. Esta página traz só o que é específico daqui: login, credenciais iniciais, onde ficam os dados e o que funciona offline. Os nomes de telas aparecem como no app, muitas vezes em inglês.

## Gerenciar

O menu **Gerenciar** de cada cartão tem:

- **Documentação**: a seção do app nesta página.
- **Editar**: portas, volumes, variáveis de ambiente, limites de memória e CPU e uma URL de abertura personalizada (proxy reverso, DNS local). Ajustes como o acesso à GPU são preservados.
- **Logs** e **Estatísticas**: saída e consumo em tempo real.
- **Atualizar** e **Remover**: se o container novo não subir, o app volta à versão anterior.

O cartão mostra a versão instalada e uma etiqueta laranja quando há atualização. Atualizações automáticas: [guia de Atualizações](/docs/updates).

## App personalizado

**Adicionar um app personalizado** roda qualquer imagem Docker (ex.: `ghcr.io/owner/app:1.2.3`) com portas, volumes, variáveis e limites. A verificação prévia avisa sobre conflitos de porta e configurações arriscadas; avisos leves (tag `:latest`, registro desconhecido) podem ser ignorados, e configurações inseguras são bloqueadas. Não há suporte para software fora do catálogo.

---

## Stirling PDF {% #stirling-pdf %}

Mais de 50 ferramentas de PDF: juntar, dividir, converter, comprimir, OCR, assinar, ocultar trechos. [Site](https://stirlingpdf.com) · [Código](https://github.com/Stirling-Tools/Stirling-PDF)

- **Acesso:** abre sem login (aparece "Guest"). Demora de 30 a 60 s para iniciar e usa ~1 GB de RAM.
- **Ativar login:** **Gerenciar › Editar**, troque `SECURITY_ENABLELOGIN=false` por `true`. Primeiro acesso: `admin` / `stirling`, e ele pede uma senha nova.
- **Arquivos:** trabalha com arquivos do seu dispositivo ("Open from computer"), não com os do servidor. Configurações em `storage/stirling-pdf`.
- **Offline:** sim. O OCR traz o inglês; outros idiomas exigem internet.

## File Browser {% #file-browser %}

Gerenciador de arquivos do servidor pelo navegador. [Site](https://filebrowser.org) · [Código](https://github.com/filebrowser/filebrowser)

- **Acesso:** `admin` / `nomad`. **Troque a senha logo**: é a mesma em todas as instalações (engrenagem › perfil).
- **Pastas:** `books`, `maps`, `media`, `zim`, `kb_uploads`. As pastas internas dos apps ficam de fora de propósito.
- **Atenção:** não há lixeira; o que você apaga some.
- **Offline:** sim.

## Calibre-Web {% #calibre-web %}

Leitor e organizador de e-books. [Código](https://github.com/janeczku/calibre-web)

- **Primeiro acesso:** em **Database Configuration**, informe `/books` e clique em **Save**.
- **Login:** `admin` / `admin123`. **Troque a senha** (`admin` › Edit).
- **Adicionar livros:** ative o envio em **Admin**, ou coloque os arquivos em `books` pelo File Browser e use "scan".
- **Dados:** pasta `books`. **Offline:** sim, menos o "fetch metadata".

## IT Tools {% #it-tools %}

Mais de 100 utilitários: hashes, base64, JSON, UUID, QR code, cores. [Site](https://it-tools.tech) · [Código](https://github.com/CorentinTh/it-tools)

- Sem login, sem dados guardados. **Offline:** sim.

## Excalidraw {% #excalidraw %}

Quadro branco para diagramas com traço de desenho à mão. [Site](https://excalidraw.com) · [Código](https://github.com/excalidraw/excalidraw)

- **Sem armazenamento no servidor:** o desenho fica no navegador e não passa para outro dispositivo; limpar os dados do navegador o apaga. Use **Save to...** para guardar um arquivo `.excalidraw`.
- **Offline:** sim, mas sem internet a fonte manuscrita vira uma fonte simples.
- Online, envia estatísticas anônimas de visualização (Simple Analytics). "Live collaboration", "Excalidraw+" e "Library" dependem da nuvem.

## Homebox {% #homebox %}

Inventário doméstico: locais, etiquetas, fotos, garantias, notas fiscais. [Site](https://homebox.software) · [Código](https://github.com/sysadminsmedia/homebox)

- **Primeiro acesso:** **Register** com e-mail, nome e senha forte. A primeira conta é a dona.
- **Bloquear novos cadastros:** **Gerenciar › Editar**, adicione `HBOX_OPTIONS_ALLOW_REGISTRATION=false`.
- **Dados:** `storage/homebox`. **Offline:** sim.

## Vaultwarden {% #vaultwarden %}

Gerenciador de senhas compatível com os apps e extensões do Bitwarden. [Site](https://bitwarden.com) · [Código](https://github.com/dani-garcia/vaultwarden)

- **Aviso de certificado:** esperado (HTTPS com certificado autoassinado). Clique em **Avançado › Ir para o endereço**; o navegador lembra a escolha.
- **Cofre:** **Create account** com e-mail e senha mestra. **A senha mestra não pode ser recuperada.**
- **Bloquear novos cadastros:** adicione `SIGNUPS_ALLOWED=false` em **Gerenciar › Editar**.
- **Celular e navegador:** no app do Bitwarden, escolha **self-hosted** e informe `https://<servidor>:8480`.
- **Dados:** `storage/vaultwarden`. **Offline:** sim; os apps mantêm uma cópia local do cofre.

## Jellyfin {% #jellyfin %}

Servidor de mídia para filmes, séries, música e fotos. [Site](https://jellyfin.org) · [Código](https://github.com/jellyfin/jellyfin)

- **Primeiro acesso:** idioma → conta de administrador → bibliotecas.
- **Uma pasta por biblioteca:** Movies → `Movies`, Shows → `TV Shows`, Music → `Music`, Photos → `Photos`. Não aponte para a pasta `media` inteira, senão aparece "duplicate path".
- **Adicionar mídia:** envie pelo File Browser para `media/<tipo>` e use **Scan Library**. Nomes como `Filme (2020).mp4` ajudam a achar as capas.
- **Dados:** mídia em `storage/media`, configurações em `storage/jellyfin`.
- **Offline:** sim, sem capas e sinopses até haver internet. Não há aceleração de vídeo por GPU: prefira MP4/H.264.

## Meshtastic Web {% #meshtastic-web %}

Painel para rádios [Meshtastic](https://meshtastic.org) (mensagens LoRa em malha, sem celular nem internet). [Código](https://github.com/meshtastic/web)

- **Precisa de um rádio Meshtastic.**
- **Conexão:** use **HTTP**, com o rádio na mesma rede Wi-Fi. Bluetooth e Serial exigem HTTPS e não funcionam aqui; para parear, use o app oficial.
- **Dados:** no rádio e no navegador. **Offline:** sim.

## Plataforma de Educação (Kolibri) {% #kolibri %}

Cursos com vídeos, exercícios, turmas e progresso por aluno. [Site](https://learningequality.org/kolibri) · [Código](https://github.com/learningequality/kolibri)

- **Primeiro acesso:** assistente de configuração e conta de administrador.
- **Conteúdo:** **Device → Channels → Import** (Kolibri Studio, disco local ou outro dispositivo).
- **Migrar da Gen 1** (`treehouses/kolibri:0.12.8`, porta 8300): instale a Gen 2, vá em **Device › Channels › Import › Local network or internet › Add new device**, informe `http://<servidor>:8300`, importe os canais e depois remova a Gen 1 (etiqueta **legado**). Dados de alunos não são migrados.
- **Dados:** `storage/kolibri-gen2`. **Offline:** sim, depois de importar os canais.

## MeshCore Web {% #meshcore-web %}

Cliente para rádios [MeshCore](https://meshcore.io). [Código](https://github.com/aXistem-dev/meshcore-web)

- **Precisa de um rádio MeshCore**, ligado por USB ou Bluetooth **ao computador que você está usando**.
- **Aviso de certificado:** esperado (HTTPS autoassinado, necessário para USB e Bluetooth). **Avançado › Ir para o endereço**.
- Use **Chrome ou Edge**. **Offline:** sim.

## Biblioteca Traduzida {% #offline-translation %}

Traduz artigos da Biblioteca de Informação: barra **Translate this page** no topo, com um botão por idioma e **Original**. É cerca de 1.600 vezes mais rápida que o Assistente de IA e não precisa de GPU.

- **Idiomas:** padrão `TRANSLATE_LANGS=fr,es,de`. Para mudar, **Gerenciar › Editar** e altere a lista (ex.: `fr,es,de,sv`). Cada idioma ocupa de 45 a 140 MB e o download exige internet.
- **Disponíveis:** Africâner (`af`), Árabe (`ar`), Basco (`eu`), Bengali (`bn`), Bósnio (`bs`), Búlgaro (`bg`), Catalão (`ca`), Croata (`hr`), Tcheco (`cs`), Dinamarquês (`da`), Holandês (`nl`), Estoniano (`et`), Finlandês (`fi`), Francês (`fr`), Galego (`gl`), Alemão (`de`), Grego (`el`), Guzerate (`gu`), Hebraico (`he`), Híndi (`hi`), Húngaro (`hu`), Islandês (`is`), Indonésio (`id`), Italiano (`it`), Japonês (`ja`), Canarês (`kn`), Coreano (`ko`), Letão (`lv`), Lituano (`lt`), Malaio (`ms`), Malaiala (`ml`), Marati (`mr`), Norueguês (`nb`), Persa (`fa`), Polonês (`pl`), Português (`pt`), Romeno (`ro`), Russo (`ru`), Sérvio (`sr`), Eslovaco (`sk`), Esloveno (`sl`), Espanhol (`es`), Sueco (`sv`), Tâmil (`ta`), Telugo (`te`), Tailandês (`th`), Turco (`tr`), Ucraniano (`uk`), Urdu (`ur`), Vietnamita (`vi`). O chinês ainda não está disponível.
- **Não traduz:** tabelas, o título da aba e os resultados da busca do Kiwix (pesquise no idioma original).
- **Precisão:** tradução automática literal; cuidado com termos médicos e de segurança.
- **Dados:** `storage/translate/models`. **Offline:** sim, depois que os modelos forem baixados.
