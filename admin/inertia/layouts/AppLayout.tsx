import AppShell from '~/layouts/AppShell'

/**
 * Default frame for app screens. Kept as a thin wrapper over AppShell so pages keep their import;
 * `compact` is accepted for compatibility (the shell has no tall header any more).
 */
export default function AppLayout({ children }: { children: React.ReactNode; compact?: boolean }) {
  return <AppShell>{children}</AppShell>
}
