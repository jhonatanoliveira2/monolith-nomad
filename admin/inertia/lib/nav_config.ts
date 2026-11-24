/**
 * Information architecture of the interface: one navigation model for the sidebar, the mobile drawer
 * and the command palette. Labels are English source keys, translated at render (inertia/locales).
 *
 * Groups follow what people come to do, in order of frequency:
 *   Knowledge (read and consult) → Content (get and manage what is stored) → Apps → System → Help.
 * Before the redesign the Supply Depot, the Content Explorer and the downloads were only reachable from
 * "Settings", and the dashboard mixed apps, content and configuration in one grid.
 */
import {
  IconAdjustments,
  IconArrowBigUpLines,
  IconBolt,
  IconBooks,
  IconBox,
  IconChartBar,
  IconCode,
  IconCpu,
  IconDashboard,
  IconDownload,
  IconFileText,
  IconFolder,
  IconGavel,
  IconHome,
  IconLifebuoy,
  IconMap,
  IconMapRoute,
  IconMessageCircle,
  IconMovie,
  IconPill,
  IconWand,
  IconWorldDownload,
} from '@tabler/icons-react'

export type NavBadge = 'update' | 'downloads'

export type NavItem = {
  id: string
  /** English source key, or a user-chosen name when `literal` is set (the AI assistant). */
  label: string
  literal?: boolean
  href: string
  icon: React.ElementType
  /** Extra path prefixes that belong to this entry (e.g. /conditions under the drug reference). */
  match?: string[]
  /** Opens outside the app (new tab). */
  external?: boolean
  /** Full page load instead of an Inertia visit (pages not rendered by Inertia, e.g. /reference). */
  hardLink?: boolean
  /** Search terms for the command palette (pt-BR and English). */
  keywords?: string
  badge?: NavBadge
}

export type NavGroup = { id: string; label?: string; items: NavItem[] }

export type NavContext = {
  aiInstalled: boolean
  aiName: string
  creatorPacks: boolean
  drugReference: boolean
  serviceLogsHref: string
}

export function buildNavigation(ctx: NavContext): NavGroup[] {
  const groups: NavGroup[] = [
    {
      id: 'home',
      items: [
        {
          id: 'home',
          label: 'Dashboard',
          href: '/home',
          icon: IconHome,
          keywords: 'inicio dashboard painel central comando',
        },
      ],
    },
    {
      id: 'knowledge',
      label: 'Knowledge',
      items: [
        {
          id: 'library',
          label: 'Library',
          href: '/library',
          icon: IconBooks,
          keywords: 'biblioteca livros pdf epub zim leitura ler books read',
        },
        {
          id: 'maps',
          label: 'Maps',
          href: '/maps',
          icon: IconMap,
          keywords: 'mapas offline map coordenadas marcadores',
        },
        ...(ctx.drugReference
          ? [
              {
                id: 'drug-reference',
                label: 'Drug Reference',
                href: '/drug-reference',
                icon: IconPill,
                match: ['/conditions'],
                keywords: 'bulario medicamentos remedios sintomas drugs',
              },
            ]
          : []),
        ...(ctx.aiInstalled
          ? [
              {
                id: 'chat',
                label: ctx.aiName,
                literal: true,
                href: '/chat',
                icon: IconMessageCircle,
                keywords: 'assistente ia chat conversa ai assistant ollama',
              },
            ]
          : []),
        {
          id: 'docs',
          label: 'Docs',
          href: '/docs/home',
          icon: IconFileText,
          match: ['/docs'],
          keywords: 'documentacao manual guia ajuda docs',
        },
      ],
    },
    {
      id: 'content',
      label: 'Content',
      items: [
        {
          id: 'content-explorer',
          label: 'Content Explorer',
          href: '/settings/zim/remote-explorer',
          icon: IconWorldDownload,
          keywords: 'explorar baixar zim wikipedia kiwix colecoes catalogo',
        },
        {
          id: 'content-manager',
          label: 'Content Manager',
          href: '/settings/zim',
          icon: IconFolder,
          keywords: 'arquivos instalados zim gerenciar armazenamento',
        },
        {
          id: 'downloads',
          label: 'Downloads',
          href: '/downloads',
          icon: IconDownload,
          badge: 'downloads',
          keywords: 'downloads fila progresso transferencias',
        },
        {
          id: 'maps-manager',
          label: 'Maps Manager',
          href: '/settings/maps',
          icon: IconMapRoute,
          keywords: 'regioes mapas baixar pmtiles',
        },
        ...(ctx.creatorPacks
          ? [
              {
                id: 'creator-packs',
                label: 'Creator Packs',
                href: '/settings/creator-packs',
                icon: IconMovie,
                keywords: 'videos pacotes criadores',
              },
            ]
          : []),
      ],
    },
    {
      id: 'apps',
      label: 'Apps',
      items: [
        {
          id: 'supply-depot',
          label: 'Supply Depot',
          href: '/supply-depot',
          icon: IconBox,
          keywords: 'apps aplicativos instalar docker deposito',
        },
        ...(ctx.aiInstalled
          ? [
              {
                id: 'models',
                label: 'AI Models',
                href: '/settings/models',
                icon: IconWand,
                keywords: 'modelos ia ollama llm models',
              },
            ]
          : []),
      ],
    },
    {
      id: 'system',
      label: 'System',
      items: [
        {
          id: 'system',
          label: 'System',
          href: '/settings/system',
          icon: IconCpu,
          keywords: 'sistema cpu memoria disco gpu hardware',
        },
        {
          id: 'update',
          label: 'Updates',
          href: '/settings/update',
          icon: IconArrowBigUpLines,
          badge: 'update',
          keywords: 'atualizacoes versao update',
        },
        {
          id: 'benchmark',
          label: 'Benchmark',
          href: '/settings/benchmark',
          icon: IconChartBar,
          keywords: 'benchmark desempenho pontuacao',
        },
        {
          id: 'advanced',
          label: 'Advanced',
          href: '/settings/advanced',
          icon: IconAdjustments,
          keywords: 'avancado configuracoes rede proxy settings',
        },
        {
          id: 'logs',
          label: 'Service Logs & Metrics',
          href: ctx.serviceLogsHref,
          icon: IconDashboard,
          external: true,
          keywords: 'logs metricas dozzle',
        },
      ],
    },
    {
      id: 'help',
      label: 'Help',
      items: [
        {
          id: 'easy-setup',
          label: 'Easy Setup',
          href: '/easy-setup',
          icon: IconBolt,
          keywords: 'configuracao rapida assistente inicial wizard setup',
        },
        {
          id: 'support',
          label: 'About & Support',
          href: '/settings/support',
          icon: IconLifebuoy,
          keywords: 'sobre suporte ajuda problema',
        },
        {
          id: 'api',
          label: 'API Reference',
          href: '/reference',
          icon: IconCode,
          hardLink: true,
          keywords: 'api openapi referencia',
        },
        {
          id: 'legal',
          label: 'Legal Notices',
          href: '/settings/legal',
          icon: IconGavel,
          keywords: 'licencas avisos legais',
        },
      ],
    },
  ]
  return groups.filter((g) => g.items.length > 0)
}

function pathOf(href: string): string {
  try {
    return new URL(href, 'http://local').pathname
  } catch {
    return href
  }
}

/**
 * The entry for the current page: the longest matching path prefix, so /settings/zim/remote-explorer
 * selects the Content Explorer and not the Content Manager.
 */
export function activeNavId(groups: NavGroup[], currentPath: string): string | null {
  let best: { id: string; len: number } | null = null
  for (const item of groups.flatMap((g) => g.items)) {
    if (item.external) continue
    for (const prefix of [pathOf(item.href), ...(item.match ?? [])]) {
      const hit =
        currentPath === prefix ||
        currentPath.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`)
      if (hit && (!best || prefix.length > best.len)) best = { id: item.id, len: prefix.length }
    }
  }
  return best?.id ?? null
}

/** Accent- and case-insensitive text for the command palette search. */
export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}
