import React from 'react'
import Markdoc from '@markdoc/markdoc'
import { Heading } from './markdoc/Heading'
import { List } from './markdoc/List'
import { ListItem } from './markdoc/ListItem'
import { Image } from './markdoc/Image'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from './markdoc/Table'

// Paragraph component
const Paragraph = ({ children }: { children: React.ReactNode }) => {
  return <p className="mb-4 leading-relaxed text-text-secondary">{children}</p>
}

// Link component
const Link = ({
  href,
  title,
  children,
}: {
  href: string
  title?: string
  children: React.ReactNode
}) => {
  const isExternal = href?.startsWith('http')
  return (
    <a
      href={href}
      title={title}
      className="text-text-primary font-medium underline decoration-text-muted underline-offset-2 hover:decoration-text-primary transition-colors"
      {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  )
}

// Inline code component
const InlineCode = ({ content, children }: { content?: string; children?: React.ReactNode }) => {
  return (
    <code className="bg-surface-elevated text-text-primary border border-border-default px-1.5 py-0.5 rounded-md nd-mono text-[0.875em] font-mono">
      {content || children}
    </code>
  )
}

// Code block component
const CodeBlock = ({
  content,
  language,
  children,
}: {
  content?: string
  language?: string
  children?: React.ReactNode
}) => {
  const code = content || (typeof children === 'string' ? children : '')
  return (
    <div className="my-6 overflow-hidden rounded-[var(--radius-card)] border border-neutral-800">
      {language && (
        <div className="bg-neutral-900 px-4 py-2 nd-eyebrow !text-[10px] !text-neutral-400 border-b border-neutral-800">
          {language}
        </div>
      )}
      <pre className="bg-neutral-950 overflow-x-auto p-4">
        <code className="text-sm font-mono text-neutral-200 leading-relaxed whitespace-pre">
          {code}
        </code>
      </pre>
    </div>
  )
}

// Horizontal rule component
const HorizontalRule = () => {
  return <hr className="my-10 nd-rule" />
}

// Callout component
const Callout = ({
  type = 'info',
  title,
  children,
}: {
  type?: string
  title?: string
  children: React.ReactNode
}) => {
  const styles: Record<string, string> = {
    info: 'bg-surface-secondary border-border-default text-text-primary',
    warning: 'bg-desert-orange-lighter border-desert-orange-light text-desert-orange-dark',
    error: 'bg-desert-red-lighter border-desert-red-light text-desert-red-dark',
    success: 'bg-desert-olive-lighter border-desert-olive-light text-desert-olive-dark',
  }

  return (
    <div className={`border rounded-[var(--radius-card)] p-5 mb-6 ${styles[type] || styles.info}`}>
      {title && <h4 className="font-medium mb-2">{title}</h4>}
      <div className="[&>p:last-child]:mb-0">{children}</div>
    </div>
  )
}

// Component mapping for Markdoc
const components = {
  Paragraph,
  Image,
  Link,
  InlineCode,
  CodeBlock,
  HorizontalRule,
  Callout,
  Heading,
  List,
  ListItem,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
}

interface MarkdocRendererProps {
  content: any // Markdoc transformed content
}

const MarkdocRenderer: React.FC<MarkdocRendererProps> = ({ content }) => {
  return (
    <div className="text-base tracking-wide">
      {Markdoc.renderers.react(content, React, { components })}
    </div>
  )
}

export default MarkdocRenderer
