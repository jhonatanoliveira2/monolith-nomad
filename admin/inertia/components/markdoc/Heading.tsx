import React, { JSX } from 'react'

export function Heading({
  level,
  id,
  children,
}: {
  level: number
  id: string
  children: React.ReactNode
}) {
  const Component = `h${level}` as keyof JSX.IntrinsicElements
  const styles: Record<number, string> = {
    1: 'text-3xl sm:text-4xl font-medium text-text-primary leading-tight pb-4 mb-6 mt-2 border-b border-border-default',
    2: 'text-2xl font-medium text-text-primary pb-2 mb-5 mt-12 border-b border-border-subtle scroll-mt-6',
    3: 'text-xl font-medium text-text-primary mb-3 mt-8 scroll-mt-6',
    4: 'nd-eyebrow !text-text-secondary !text-xs mb-2 mt-6',
    5: 'text-base font-medium text-text-primary mb-2 mt-5',
    6: 'text-sm font-medium text-text-secondary mb-2 mt-4',
  }

  return (
    // @ts-ignore
    <Component id={id} className={styles[level]}>
      {children}
    </Component>
  )
}
