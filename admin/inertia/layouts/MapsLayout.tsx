import AppShell from '~/layouts/AppShell'

/** The map uses the whole screen: icon rail on desktop, its own toolbar everywhere. */
export default function MapsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell variant="immersive">{children}</AppShell>
}
