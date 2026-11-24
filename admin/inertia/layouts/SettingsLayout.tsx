import AppShell from '~/layouts/AppShell'

/**
 * Settings screens used to have their own sidebar; they are now groups of the global navigation
 * (Content, Apps, System, Help), so this is the default frame.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
