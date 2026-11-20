import { usePage } from '@inertiajs/react'

/** Shared `project` prop (config/inertia.ts, from constants/project.ts). */
export type ProjectProps = {
  name: string
  repoUrl: string
  issuesUrl: string
  /** Public benchmark leaderboard; null when not configured (sharing is hidden). */
  leaderboardUrl: string | null
  /** Release-note e-mail list configured; the subscribe form is hidden otherwise. */
  releaseNotesEnabled: boolean
}

export function useProject(): ProjectProps {
  return usePage<{ project: ProjectProps }>().props.project
}
