export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto my-6 rounded-xl border border-border-default">
      <table className="min-w-full divide-y divide-border-default">{children}</table>
    </div>
  )
}

export function TableHead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-surface-secondary">{children}</thead>
}

export function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-border-subtle bg-surface-primary">{children}</tbody>
}

export function TableRow({ children }: { children: React.ReactNode }) {
  return <tr className="hover:bg-surface-secondary transition-colors">{children}</tr>
}

export function TableHeader({ children }: { children: React.ReactNode }) {
  return <th className="px-5 py-3 text-left nd-eyebrow !text-[10px] font-normal">{children}</th>
}

export function TableCell({ children }: { children: React.ReactNode }) {
  return <td className="px-5 py-3.5 text-sm text-text-primary">{children}</td>
}
