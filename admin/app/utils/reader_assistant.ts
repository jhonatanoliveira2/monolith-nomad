/**
 * Pure parts of the reader assistant (chat, explanation and summaries inside the PDF/EPUB reader):
 * prompts, the user instruction per action, and how a long passage is summarised in parts. No I/O.
 */

export type ReaderAction = 'chat' | 'explain' | 'summarize'

export type ReaderWork = { title: string; authors: string[]; year: string | null }

export type ReaderPassage = {
  text: string
  /** "p. 12", "p. 12–13", a chapter title */
  label: string
  page?: number
  href?: string
}

/** A summary of more than this is done in parts (map), then combined (reduce). */
export const SUMMARY_PART_CHARS = 5_000
export const READER_MAX_PASSAGE_CHARS = 24_000
export const READER_MAX_SELECTION_CHARS = 4_000

export function buildReaderSystemPrompt(work: ReaderWork, passage: ReaderPassage): string {
  const who = work.authors.length ? `, de ${work.authors.join(', ')}` : ''
  const when = work.year ? ` (${work.year})` : ''
  return [
    `Você é o assistente de leitura do monolith-nomad e roda offline. O usuário está lendo "${work.title}"${who}${when}, em ${passage.label}.`,
    'Responda em português do Brasil, a menos que o usuário peça outro idioma.',
    '',
    'REGRAS',
    `1. A fonte principal é o trecho aberto (${passage.label}) e os trechos do mesmo livro que vierem na mensagem. Cite as páginas ou capítulos que usar, como [p. 12] ou [cap. "Água"].`,
    '2. Se a resposta não estiver no livro, diga isso e, se ajudar, dê uma explicação geral marcada como "fora do livro".',
    '3. Não invente citações, números de página, dados ou referências.',
    '4. Explique termos técnicos com palavras simples e exemplos curtos.',
    '',
    `[Trecho aberto — ${passage.label}]`,
    passage.text,
  ].join('\n')
}

/** What the model is asked to do, per action. */
export function readerInstruction(
  action: ReaderAction,
  input: { selection?: string | null; question?: string | null; label: string }
): string {
  const selection = input.selection?.trim()
  if (action === 'explain') {
    return selection
      ? `Explique este trecho que selecionei (${input.label}), em linguagem simples, dizendo o que significa e por que importa no contexto do livro:\n\n"${selection}"`
      : `Explique o trecho aberto (${input.label}) em linguagem simples: ideias principais, termos difíceis e por que importam.`
  }
  if (action === 'summarize') {
    return `Resuma o trecho aberto (${input.label}) em tópicos curtos, mantendo números, procedimentos e alertas importantes. Indique as páginas de cada ponto quando houver.`
  }
  const question = input.question?.trim() || 'O que diz este trecho?'
  return selection
    ? `${question}\n\nTrecho selecionado (${input.label}):\n"${selection}"`
    : question
}

/** Context block wrapper for passages retrieved from the same book. */
export function readerContextTemplate(context: string): string {
  return [
    'Outros trechos do mesmo livro, encontrados por busca (podem ajudar a responder):',
    '',
    context,
    '',
    'Cite-os pela página ou capítulo do rótulo de cada trecho.',
  ].join('\n')
}

/**
 * Split a long passage into parts for a map-reduce summary, on paragraph breaks when possible, so
 * no part exceeds `max` characters.
 */
export function summaryParts(text: string, max = SUMMARY_PART_CHARS): string[] {
  if (text.length <= max) return [text]
  const parts: string[] = []
  let current = ''
  for (const para of text.split(/\n\s*\n/)) {
    if (para.length > max) {
      if (current) parts.push(current)
      current = ''
      for (let i = 0; i < para.length; i += max) parts.push(para.slice(i, i + max))
      continue
    }
    if (current && current.length + para.length + 2 > max) {
      parts.push(current)
      current = para
    } else {
      current = current ? `${current}\n\n${para}` : para
    }
  }
  if (current) parts.push(current)
  return parts
}

export function partSummaryInstruction(index: number, total: number, label: string): string {
  return `Esta é a parte ${index + 1} de ${total} de ${label}. Resuma-a em até 6 tópicos curtos, mantendo números, procedimentos e alertas. Não comente que é uma parte.`
}

export function combineSummariesPassage(partials: string[], label: string): ReaderPassage {
  return {
    label,
    text: partials.map((p, i) => `[Parte ${i + 1}]\n${p}`).join('\n\n'),
  }
}
