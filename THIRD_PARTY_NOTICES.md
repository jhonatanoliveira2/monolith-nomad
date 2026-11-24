# Avisos de terceiros (THIRD_PARTY_NOTICES)

O **monolith-nomad** é uma distribuição independente, derivada do Project N.O.M.A.D. Este arquivo reúne créditos, licenças e avisos de marca dos componentes de terceiros e das origens de cada parte derivada.

**O monolith-nomad não é oficial nem afiliado** ao Project N.O.M.A.D./Crosstalk Solutions, LLC, à Canonical Ltd. (Ubuntu) ou à Nothing Technology Limited, e não é endossado por nenhum deles.

## 1. Obra original: Project N.O.M.A.D.

- **Origem:** <https://github.com/Crosstalk-Solutions/project-nomad>
- **Copyright** 2024-2026 Crosstalk Solutions, LLC
- **Licença:** Apache License 2.0. O texto integral está em [`LICENSE`](LICENSE), mantido sem alterações.
- **O que é derivado:**
  - todo o aplicativo `admin/` (AdonisJS + Inertia/React);
  - o instalador e os scripts em `install/`;
  - as imagens auxiliares (sidecar updater, disk collector, translate proxy);
  - os catálogos em `collections/`;
  - a documentação em `admin/docs/`.
- **Modificações deste fork** (Apache-2.0, seção 4(b)): **os arquivos listados em [`MODIFICATIONS.md`](MODIFICATIONS.md) foram alterados, adicionados ou removidos pelo mantenedor do monolith-nomad** em relação ao commit `f633b36` do projeto original (versão 1.35.2-rc.1). Os demais estão como no original. A lista é gerada por `scripts/list-modifications.sh` e conferida por teste (`admin/tests/unit/repo_hygiene.spec.ts`). O que mudou e por quê está em [`docs/`](docs/) e no `CHANGELOG`. As principais mudanças são:
  - downloads inteligentes: metalink, benchmark de mirrors, aria2c, SHA-256 ([`docs/downloads.md`](docs/downloads.md));
  - independência do fork: repositório, imagens, atualizações e serviços online ([`docs/distribuicao.md`](docs/distribuicao.md));
  - identidade visual Nothing e tradução para pt-BR.
- "Project N.O.M.A.D." e "NOMAD" são nomes do projeto original. Neste fork, os identificadores técnicos (`/opt/project-nomad`, containers `nomad_*`, imagens `project-nomad*`, cabeçalhos `X-NOMAD-*`) foram mantidos **só por compatibilidade** de instalação e atualização, não como marca.

## 2. Conteúdo e serviços que continuam sendo do projeto original

São usados como dependências externas de **dados** e não são redistribuídos por este repositório:

| Item | Origem | Uso |
|---|---|---|
| Mapas regionais `.pmtiles` e assets base dos mapas | `github.com/Crosstalk-Solutions/project-nomad-maps` | mapas offline (`collections/maps.json`) |
| Imagem `nomad-sysbench` | `ghcr.io/crosstalk-solutions/nomad-sysbench@sha256:1f08e527…` (fixada por digest) | benchmark de hardware |
| Creator Packs | catálogo e licença próprios (`collections/creator-pack-license.md`) | conteúdo restrito, desligado sem chave |
| Serviços online (leaderboard, newsletter, lista de modelos) | `*.projectnomad.us` | **desligados por padrão** ([`docs/distribuicao.md`](docs/distribuicao.md)) |

## 3. Marcas

- **Ubuntu e o logotipo "Circle of Friends"** são marcas registradas da **Canonical Ltd.** A interface usa uma versão monocromática do Circle of Friends, por escolha do mantenedor, para indicar que o monolith-nomad roda em Ubuntu (`admin/inertia/components/UbuntuLogo.tsx`, `admin/public/logo.svg`, `admin/public/favicon-*.png`). A geometria é **derivada** do arquivo [`UbuntuCoF.svg`](https://commons.wikimedia.org/wiki/File:UbuntuCoF.svg) do Wikimedia Commons (autor: Canonical Ltd., fonte: Ubuntu Visual Identity, 2010), redesenhado como versão monocromática em `currentColor`. No Commons, o arquivo está em **domínio público** pelo modelo **PD-textlogo** (não atinge o limiar de originalidade para proteção por direito autoral), com o aviso "Trademarked": o domínio público vale só para o direito autoral, não para a marca (consultado em 20/11/2026). O uso de marca da Canonical está sujeito à política dela (<https://ubuntu.com/legal/trademarks>). **Antes de redistribuir publicamente, confirme se esse uso é permitido** ou troque por uma marca própria.
- **Nothing** é marca da Nothing Technology Limited. O tema visual é inspirado na linguagem de matriz de pontos do tema "Nothing" do shell MONOLITH, que por sua vez se inspira no **NIHIL Shell** (licença MIT). **Nenhum código, asset ou arquivo do NIHIL Shell foi copiado para este repositório:** a textura de pontos é CSS próprio (`admin/inertia/css/app.css`) e os valores de cor vêm dos tokens do tema do MONOLITH. O código adaptado do NIHIL Shell (`dotmatrix.py`, com o aviso MIT dele) fica no repositório do shell, não aqui. Não há afiliação com a Nothing Technology Limited, e nenhum asset dela é usado.

## 4. Fontes (SIL Open Font License 1.1)

Distribuídas em `admin/public/fonts/nothing/`. São os mesmos arquivos e a mesma revisão usados pelo monolith-dotfiles: `google/fonts@5174b3333331c966c38f4355d50b03ca1c1df2f9`, com SHA-256 conferido na cópia. Cada licença acompanha a fonte:

| Fonte | Licença |
|---|---|
| Doto | OFL 1.1 ([`Doto-OFL.txt`](admin/public/fonts/nothing/Doto-OFL.txt)) |
| Space Grotesk | OFL 1.1 ([`SpaceGrotesk-OFL.txt`](admin/public/fonts/nothing/SpaceGrotesk-OFL.txt)) |
| Space Mono | OFL 1.1 ([`SpaceMono-OFL.txt`](admin/public/fonts/nothing/SpaceMono-OFL.txt)) |

Os arquivos de fonte variável foram renomeados (`Doto[ROND,wght].ttf` → `Doto-Variable.ttf`, `SpaceGrotesk[wght].ttf` → `SpaceGrotesk-Variable.ttf`) só para facilitar o uso em URLs. O conteúdo não mudou.

## 5. Software incluído na imagem do admin

| Componente | Licença | Observação |
|---|---|---|
| aria2 (`aria2c`) | GPL-2.0-or-later | pacote `aria2` do Debian, executado como programa separado ([`docs/downloads.md`](docs/downloads.md)) |
| go-pmtiles | BSD-3-Clause | baixado no build com SHA-256 fixado (`Dockerfile`) |
| Node.js 22 | MIT | imagem base `node:22.23.5-slim` (Debian) |
| Dependências npm do admin | as licenças de cada pacote | em `admin/package-lock.json` e `admin/node_modules/*/LICENSE` |
| pdf.js (`pdfjs-dist`, Mozilla) | Apache-2.0 | leitor de PDF integrado da Biblioteca (`admin/inertia/components/reader/PdfReader.tsx`), carregado sob demanda e servido localmente; as regras da camada de texto em `admin/inertia/css/app.css` vêm do `web/pdf_viewer.css` do mesmo pacote |
| epub.js | BSD-2-Clause | leitor de EPUB integrado da Biblioteca (`admin/inertia/components/reader/EpubReader.tsx`) |
| Natural Earth (admin-1, 1:50m) | domínio público | polígonos dos 27 estados brasileiros em `admin/resources/geodata/ne_50m_admin_1_brazil.geojson`, reduzidos ao código ISO 3166-2 e ao nome, com coordenadas arredondadas (recortes de mapa por estado e região) |

## 6. Aplicativos e conteúdos instaláveis

O monolith-nomad orquestra, via Docker, aplicativos de terceiros baixados dos registros dos próprios autores (Kiwix, Kolibri, Ollama, Qdrant, CyberChef, FlatNotes, Stirling-PDF, Calibre-Web, Jellyfin, Vaultwarden, Excalidraw, Meshtastic, MeshCore, Homebox, IT-Tools, entre outros; a lista está em `admin/database/seeders/service_seeder.ts`). Cada um tem a própria licença e marca. O conteúdo offline (ZIMs do Kiwix/openZIM, mapas do Protomaps/OpenStreetMap, dados do openFDA, modelos de IA) segue as licenças das fontes.

- **Kiwix/openZIM:** os mirrors e o SHA-256 de cada ZIM vêm do metalink publicado por `download.kiwix.org` (MirrorBrain).
- **Mapas:** dados © colaboradores do OpenStreetMap (ODbL), tiles do Protomaps.
