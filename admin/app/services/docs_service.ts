import Markdoc from '@markdoc/markdoc'
import { streamToString } from '../../util/docs.js'
import { getFile, getFileStatsIfExists, listDirectoryContentsRecursive } from '../utils/fs.js'
import { blockingFindings, markdocConfig } from '../utils/docs_markdoc.js'
import path from 'path'
import InternalServerErrorException from '#exceptions/internal_server_error_exception'
import logger from '@adonisjs/core/services/logger'
import {
  DEFAULT_LOCALE,
  docTitle,
  localizedDocCandidates,
  parseDocFilename,
  type Locale,
} from '../utils/locale.js'

export class DocsService {
  private docsPath = path.join(process.cwd(), 'docs')

  private static readonly DOC_ORDER: Record<string, number> = {
    'home': 1,
    'getting-started': 2,
    'use-cases': 3,
    'supply-depot-apps': 4,
    'drug-reference': 5,
    'community-add-ons': 6,
    'updates': 7,
    'faq': 8,
    'about': 9,
    'release-notes': 10,
  }

  /** One entry per document; `<slug>.<locale>.md` translations are merged into their slug. */
  async getDocs(locale: Locale = DEFAULT_LOCALE) {
    const contents = await listDirectoryContentsRecursive(this.docsPath)
    const files: Array<{ title: string; slug: string }> = []
    const seen = new Set<string>()

    for (const item of contents) {
      if (item.type === 'file' && item.name.endsWith('.md')) {
        const { slug } = parseDocFilename(item.name)
        if (seen.has(slug)) continue
        seen.add(slug)
        files.push({
          title: docTitle(slug, locale) ?? this.prettify(`${slug}.md`),
          slug,
        })
      }
    }

    return files.sort((a, b) => {
      const orderA = DocsService.DOC_ORDER[a.slug] ?? 999
      const orderB = DocsService.DOC_ORDER[b.slug] ?? 999
      return orderA - orderB
    })
  }

  parse(content: string) {
    try {
      const ast = Markdoc.parse(content)
      const errors = Markdoc.validate(ast, markdocConfig)

      const criticalErrors = blockingFindings(errors)
      if (criticalErrors.length > 0) {
        logger.error('Markdoc validation errors:', errors.map((e) => JSON.stringify(e.error)).join(', '))
        throw new Error('Markdoc validation failed')
      }

      return Markdoc.transform(ast, markdocConfig)
    } catch (error) {
      logger.error('Error parsing Markdoc content:', error)
      throw new InternalServerErrorException(`Error parsing content: ${(error as Error).message}`)
    }
  }

  async parseFile(_filename: string, locale: Locale = DEFAULT_LOCALE) {
    try {
      if (!_filename) {
        throw new Error('Filename is required')
      }

      // translation first (<slug>.<locale>.md), then the English original (<slug>.md)
      const basePath = path.resolve(this.docsPath)
      let fullPath: string | null = null
      let filename = ''
      for (const candidate of localizedDocCandidates(_filename, locale)) {
        // Prevent path traversal — resolved path must stay within the docs directory
        const resolved = path.resolve(path.join(this.docsPath, candidate))
        if (!resolved.startsWith(basePath + path.sep)) {
          throw new Error('Invalid document slug')
        }
        filename = candidate
        if (await getFileStatsIfExists(resolved)) {
          fullPath = resolved
          break
        }
      }
      if (!fullPath) {
        throw new Error(`File not found: ${filename}`)
      }

      const fileStream = await getFile(fullPath, 'stream')
      if (!fileStream) {
        throw new Error(`Failed to read file stream: ${filename}`)
      }
      const content = await streamToString(fileStream)
      return this.parse(content)
    } catch (error) {
      throw new InternalServerErrorException(`Error parsing file: ${(error as Error).message}`)
    }
  }

  private static readonly TITLE_OVERRIDES: Record<string, string> = {
    'faq': 'FAQ',
    'community-add-ons': 'Community Add-Ons',
  }

  private prettify(filename: string) {
    const slug = filename.replace(/\.md$/, '')
    if (DocsService.TITLE_OVERRIDES[slug]) {
      return DocsService.TITLE_OVERRIDES[slug]
    }
    // Remove hyphens, underscores, and file extension
    const cleaned = slug.replace(/_/g, ' ').replace(/-/g, ' ')
    // Convert to Title Case
    const titleCased = cleaned.replace(/\b\w/g, (char) => char.toUpperCase())
    return titleCased.charAt(0).toUpperCase() + titleCased.slice(1)
  }
}
