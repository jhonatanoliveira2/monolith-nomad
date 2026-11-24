# Sistema visual e arquitetura da interface

A interface do monolith-nomad segue uma linguagem inspirada no Nothing OS: monocromática, com pontos e módulos, tipografia com personalidade e cor só onde há significado. Este documento descreve a organização das telas, os tokens e os componentes reutilizáveis. Quem for criar ou alterar uma tela deve começar por aqui.

> Não há afiliação com a Nothing Technology Limited e nenhum asset dela é usado. Detalhes em [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md).

## 1. Arquitetura de informação

Uma única moldura (`admin/inertia/layouts/AppShell.tsx`) envolve todas as telas. A navegação global fica em `admin/inertia/lib/nav_config.ts`, que é a fonte única da barra lateral, do menu móvel e da paleta de comandos.

| Grupo | Telas | Para quê |
|---|---|---|
| (topo) | Início | estado do servidor e atalhos |
| Conhecimento | Biblioteca, Mapas, Bulário\*, Assistente de IA\*, Documentação | ler e consultar |
| Conteúdo | Explorador de Conteúdo, Gerenciador de Conteúdo, Downloads, Gerenciador de Mapas, Pacotes de Criadores\* | obter e gerenciar o que fica no disco |
| Apps | Depósito de Apps, Modelos de IA\* | instalar e operar aplicativos |
| Sistema | Sistema, Atualizações, Benchmark, Avançado, Logs e Métricas | saúde e configuração |
| Ajuda | Configuração Rápida, Sobre e Suporte, Referência da API, Avisos Legais | começar e obter ajuda |

\* Só aparece quando o módulo existe: o Bulário depende do conjunto de dados da FDA (prop compartilhada `features.drugReference`); o Assistente e os Modelos dependem do Ollama instalado; os Pacotes de Criadores dependem da chave da release.

**Antes do redesign**, o Depósito de Apps, o Explorador de Conteúdo e os downloads só eram alcançáveis por "Configurações", o painel misturava apps, conteúdo e configuração numa grade única de cartões iguais, e cada tela tinha seu próprio cabeçalho.

### Painel (Início)
Hierarquia de cima para baixo:

1. **Onde estou:** a Central de Comando, o estado dos apps em uma frase e o relógio.
2. **Avisos:** atualização disponível, novidades da versão, benchmark para refazer. Só aparece o que pede atenção.
3. **Estado do sistema:** conexão, processador, memória e armazenamento, além dos downloads em andamento (se houver).
4. **Conhecimento:** os módulos principais, com contexto (por exemplo, "37 obras · 5 baixadas").
5. **Apps:** apps gerenciados, com o estado do container, e os atalhos do usuário.
6. **Ferramentas:** Configuração Rápida, Explorador, Gerenciador e Configurações.

### Encontrar funcionalidades
- **Paleta de comandos:** `Ctrl K` (ou `/`) abre uma busca por todas as telas e ações, que ignora acentos e aceita palavras em português e em inglês ("livros", "pdf" e "books" encontram a Biblioteca). Texto livre vira uma busca na Biblioteca.
- **Telas imersivas** (mapa, conversa, leitor): a barra lateral vira um trilho de ícones, para que o conteúdo use quase toda a largura.

## 2. Tokens

Os tokens ficam em `admin/inertia/css/app.css` (bloco `@theme` e `[data-theme="dark"]`). O tema escuro (OLED) é o padrão; o claro é o mesmo sistema invertido. Os nomes `desert-*` foram mantidos por compatibilidade, porque aparecem em cerca de 750 lugares.

| Papel | Token | Uso |
|---|---|---|
| Fundo da página | `desert-sand` (+ campo de pontos) | sempre atrás de tudo |
| Superfície | `surface-primary` | cartões (`.nd-card`) |
| Elevado | `surface-elevated` | item ativo, ícones em círculo, popovers |
| Linha | `border-default` / `border-subtle` | bordas finas e divisórias |
| Texto | `text-primary` / `-secondary` / `-muted` | conteúdo, apoio, metadados |
| Acento | `accent` / `accent-contrast` | ação principal (pílula invertida), seleção |
| LED | `led` / `led-off` | indicadores, medidores, níveis |
| Vidro | `glass` (+ `.nd-glass`) | barras e notificações sobre conteúdo |
| Alerta | `alert` (#d71921) | erros e ações destrutivas; único uso decorativo: o ponto da marca |
| Aviso / sucesso | `desert-orange-*` / `desert-olive-*` | só quando há significado (bula, falhas, concluído) |

As rampas semânticas seguem a convenção `-lighter` (superfície tingida), `-light` (borda), base (indicador ou fundo com texto branco) e `-dark` (texto sobre `-lighter`). O contraste mínimo de 4,5:1 é verificado pelo teste `admin/tests/unit/theme_tokens.spec.ts`.

**Raios:** `--radius-card` (20 px) para cartões e `--radius-panel` (28 px) para diálogos e a paleta. Botões, chips e controles usam pílula.
**Espaçamento:** grade de 4 px. Cartões com `p-5`, seções separadas por `space-y-10` e páginas em `.nd-page` (largura máxima de 80 rem).
**Movimento:** 140 ms para resposta a um gesto, 240 ms para mudança de estado e 480 ms para entrada, sempre com a curva `--ease-nothing`. `prefers-reduced-motion` desliga as animações.

## 3. Tipografia

| Papel | Fonte | Classe |
|---|---|---|
| Números, relógio, marca | Doto (matriz de pontos) | `.nd-display`, `.font-dot` |
| Títulos e texto | Space Grotesk | padrão; títulos com `font-medium` e tracking negativo |
| Rótulos, grupos, metadados | Space Mono, caixa alta | `.nd-eyebrow`, `.nd-mono` |

Os títulos não usam negrito pesado. O peso visual vem do tamanho e do espaço em branco.

## 4. Componentes

Os primitivos ficam em `admin/inertia/components/nd/`:

| Componente | Para quê |
|---|---|
| `PageHeader` | início de toda tela: rótulo do grupo, título, uma frase e as ações |
| `Section` | grupo titulado (rótulo mono, contagem, link à direita) |
| `StatTile` | uma leitura do sistema, com número em Doto e medidor opcional |
| `DotMeter` | medidor em LEDs (laranja a partir de 70 %, vermelho a partir de 90 %) |
| `StatusDot` | um LED: `ok`, `warn`, `error`, `idle`, `live` (pisca) e `neutral`, sempre acompanhado de texto |
| `Badge` | etiqueta mono (formato, nível, estado) |
| `Chip` | filtro alternável com contagem |
| `SegmentedControl` | escolha única entre poucas vistas (setas do teclado) |
| `Drawer` | painel lateral (detalhes, filtros no celular) |
| `EmptyState` | estado vazio ou de erro, com o próximo passo |
| `IconButton` | botão só com ícone e rótulo acessível obrigatório |

Os componentes antigos foram mantidos com a mesma API e redesenhados: `StyledButton`, `StyledModal` (título à esquerda e ações à direita; vira folha inferior no celular), `Alert` (o `solid` informativo virou painel neutro elevado; antes, o botão principal ficava ilegível no escuro), `StyledTable`, `StyledSectionHeader` (LED e régua pontilhada), `Input`, `Select`, `Switch`, `LoadingSpinner` (três LEDs), `ProgressBar` e as notificações (vidro, botão de fechar, `aria-live`).

### Estados padronizados
- **Carregando:** `.nd-skeleton` no formato do conteúdo, ou `LoadingSpinner` quando não há forma prévia.
- **Vazio:** `EmptyState` com campo de pontos.
- **Erro:** `EmptyState tone="error"` com "Tentar de novo", ou `Alert type="error"`.
- **Concluído:** notificação de sucesso e LED `ok`.
- **Em andamento:** LED `live` (piscando) e barra de progresso.

## 5. Biblioteca e leitores

- **Filtros:** área → assunto (subcategoria), nível, formato, idioma e disponibilidade offline, mais a busca, que ignora acentos e exige todas as palavras. Cada opção mostra quantas obras deixaria. A lógica pura fica em `admin/inertia/lib/library_filters.ts`, testada em `admin/tests/unit/library_filters.spec.ts`. Os filtros ficam na URL, então a vista pode ser guardada e sobrevive à ida ao leitor.
- **Detalhes da obra:** painel lateral com descrição, autores, editora, edição, ano, idioma, níveis, assuntos (que filtram ao clicar), arquivos (download, leitura, remoção com confirmação, verificação SHA-256) e origem e licença.
- **Leitor de PDF** (pdf.js, build legacy para navegadores mais antigos do Ubuntu): páginas desenhadas sob demanda, sumário do PDF, busca no texto com destaques, navegação por página, zoom e ajuste à largura, páginas escuras e a última página lembrada. O visualizador do navegador continua disponível pelo botão "Abrir arquivo".
- **Leitor de EPUB** (epub.js, scripts do livro desligados): sumário, busca no livro, tema claro, sépia ou escuro, serifa ou sem serifa, tamanho do texto, barra de progresso e posição lembrada.
- **Continuar lendo:** o leitor guarda os últimos documentos abertos (`localStorage`), e a Biblioteca mostra os que ainda estão instalados.

## 6. Acessibilidade

- Link "Pular para o conteúdo", landmark `<main>` único e `aria-current` na navegação.
- Foco visível em tudo (anel do acento). Cartões clicáveis são botões ou links de verdade, alcançáveis pelo teclado.
- Cor nunca é o único sinal: cada LED tem texto ao lado ou `aria-label`.
- Medidores com `role="meter"`, progresso com `role="progressbar"` e notificações em `aria-live`.
- Contraste de 4,5:1 nas rampas semânticas, garantido por teste.

## 7. Como fazer uma tela nova

```tsx
import AppLayout from '~/layouts/AppLayout'
import PageHeader from '~/components/nd/PageHeader'
import Section from '~/components/nd/Section'

export default function MinhaTela() {
  const { t } = useTranslation()
  return (
    <AppLayout>
      <div className="nd-page">
        <PageHeader eyebrow={t('Content')} title={t('My screen')} description={t('One sentence.')} />
        <Section id="algo" title={t('Something')}>
          <div className="nd-card p-5">…</div>
        </Section>
      </div>
    </AppLayout>
  )
}
```

1. Se a tela tiver entrada na navegação, acrescente o item ao grupo certo em `nav_config.ts`, com palavras-chave em português e em inglês.
2. Os textos ficam em inglês no código e em pt-BR em `admin/inertia/locales/pt-BR/*.json` (ver `admin/inertia/locales/README.md`).
3. Use tokens, nunca cores da paleta do Tailwind. O teste `theme_tokens.spec.ts` acusa classes cromáticas.
