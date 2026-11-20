import KVStore from '#models/kv_store'
import { SystemService } from '#services/system_service'
import { defineConfig } from '@adonisjs/inertia'
import type { InferSharedProps } from '@adonisjs/inertia/types'
import {
  BENCHMARK_LEADERBOARD_URL,
  GITHUB_REPO_URL,
  PROJECT_NAME,
  RELEASE_NOTES_SUBSCRIBE_URL,
} from '../constants/project.js'

let _assistantNameCache: { value: string; expiresAt: number } | null = null

export function invalidateAssistantNameCache() {
  _assistantNameCache = null
}

const inertiaConfig = defineConfig({
  /**
   * Path to the Edge view that will be used as the root view for Inertia responses
   */
  rootView: 'inertia_layout',

  /**
   * Data that should be shared with all rendered pages
   */
  sharedData: {
    appVersion: () => SystemService.getAppVersion(),
    environment: process.env.NODE_ENV || 'production',
    // where this distribution lives and which upstream online services are configured (constants/project.ts)
    project: {
      name: PROJECT_NAME,
      repoUrl: GITHUB_REPO_URL,
      issuesUrl: `${GITHUB_REPO_URL}/issues`,
      leaderboardUrl: BENCHMARK_LEADERBOARD_URL || null,
      releaseNotesEnabled: !!RELEASE_NOTES_SUBSCRIBE_URL,
    },
    aiAssistantName: async () => {
      const now = Date.now()
      if (_assistantNameCache && now < _assistantNameCache.expiresAt) {
        return _assistantNameCache.value
      }
      const customName = await KVStore.getValue('ai.assistantCustomName')
      const value = (customName && customName.trim()) ? customName : 'AI Assistant'
      _assistantNameCache = { value, expiresAt: now + 60_000 }
      return value
    },
  },

  /**
   * Options for the server-side rendering
   */
  ssr: {
    enabled: false,
    entrypoint: 'inertia/app/ssr.tsx'
  }
})

export default inertiaConfig

declare module '@adonisjs/inertia/types' {
  export interface SharedProps extends InferSharedProps<typeof inertiaConfig> {}
}