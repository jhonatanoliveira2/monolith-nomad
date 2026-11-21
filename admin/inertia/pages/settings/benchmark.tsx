import { Head, Link, usePage } from '@inertiajs/react'
import { useProject } from '~/hooks/use_project'
import { useState } from 'react'
import SettingsLayout from '~/layouts/SettingsLayout'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import CircularGauge from '~/components/systeminfo/CircularGauge'
import InfoCard from '~/components/systeminfo/InfoCard'
import Alert from '~/components/Alert'
import StyledButton from '~/components/StyledButton'
import InfoTooltip from '~/components/InfoTooltip'
import BuilderTagSelector from '~/components/BuilderTagSelector'
import {
  IconRobot,
  IconChartBar,
  IconCpu,
  IconDatabase,
  IconServer,
  IconChevronDown,
  IconClock,
} from '@tabler/icons-react'
import { BenchmarkStatus } from '../../../types/benchmark'
import BenchmarkResult from '#models/benchmark_result'
import api from '~/lib/api'
import useServiceInstalledStatus from '~/hooks/useServiceInstalledStatus'
import { SERVICE_NAMES } from '../../../constants/service_names'
import { useBenchmarkRun } from '~/hooks/use_benchmark_run'
import BenchmarkRunView from '~/components/benchmark/BenchmarkRunView'
import ScoreReveal from '~/components/benchmark/ScoreReveal'
import { getScoreDisplay } from '~/lib/benchmark_score'
import { useTranslation } from 'react-i18next'
import { formatDate, formatDateTime, formatNumber } from '~/lib/format'

export default function BenchmarkPage(props: {
  benchmark: {
    latestResult: BenchmarkResult | null
    status: BenchmarkStatus
    currentBenchmarkId: string | null
  }
}) {
  const { aiAssistantName } = usePage<{ aiAssistantName: string }>().props
  const { leaderboardUrl } = useProject()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const aiInstalled = useServiceInstalledStatus(SERVICE_NAMES.OLLAMA)
  const [isRunning, setIsRunning] = useState(props.benchmark.status !== 'idle')
  const [revealing, setRevealing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showAIRequiredAlert, setShowAIRequiredAlert] = useState(false)
  const [shareAnonymously, setShareAnonymously] = useState(false)
  const [currentBuilderTag, setCurrentBuilderTag] = useState<string | null>(
    props.benchmark.latestResult?.builder_tag || null
  )

  // Fetch latest result
  const { data: latestResult, refetch: refetchLatest } = useQuery({
    queryKey: ['benchmark', 'latest'],
    queryFn: async () => {
      const res = await api.getLatestBenchmarkResult()
      if (res && res.result) {
        return res.result
      }
      return null
    },
    initialData: props.benchmark.latestResult,
  })

  // Live run state: owns the progress + telemetry SSE subscriptions.
  const run = useBenchmarkRun({
    onFinished: (status, message) => {
      setIsRunning(false)
      if (status === 'completed') {
        refetchLatest()
        setRevealing(true)
      } else {
        setErrorMsg(message || t('Benchmark failed'))
      }
    },
  })

  // Fetch all benchmark results for history
  const { data: benchmarkHistory } = useQuery({
    queryKey: ['benchmark', 'history'],
    queryFn: async () => {
      const res = await api.getBenchmarkResults()
      if (res && res.results && Array.isArray(res.results)) {
        return res.results
      }
      return []
    },
  })

  // Run benchmark mutation (async: dispatched to the queue worker; live progress
  // and completion arrive over SSE via useBenchmarkRun).
  const runBenchmark = useMutation({
    mutationFn: async (type: 'full' | 'system' | 'ai') => {
      setErrorMsg(null)
      run.reset()
      setIsRunning(true)

      // Use sync mode - runs inline without needing Redis/queue worker
      return await api.runBenchmark(type, true)
    },
    onSuccess: (data) => {
      // Dispatch only confirms the job started; the 'completed'/'error' SSE event
      // drives the rest (see useBenchmarkRun's onFinished).
      if (!data?.success) {
        setIsRunning(false)
        setErrorMsg(t('Failed to start benchmark'))
      }
    },
    onError: (error) => {
      setIsRunning(false)
      setErrorMsg(error.message || t('Failed to start benchmark'))
    },
  })

  // Update builder tag mutation
  const updateBuilderTag = useMutation({
    mutationFn: async ({
      benchmarkId,
      builderTag,
    }: {
      benchmarkId: string
      builderTag: string
      invalidate?: boolean
    }) => {
      const res = await api.updateBuilderTag(benchmarkId, builderTag)
      if (!res || !res.success) {
        throw new Error(res?.error || t('Failed to update builder tag'))
      }
      return res
    },
    onSuccess: (_, variables) => {
      if (variables.invalidate) {
        refetchLatest()
        queryClient.invalidateQueries({ queryKey: ['benchmark', 'history'] })
      }
    },
  })

  // Submit to repository mutation
  const [submitError, setSubmitError] = useState<string | null>(null)
  const submitResult = useMutation({
    mutationFn: async ({ benchmarkId, anonymous }: { benchmarkId: string; anonymous: boolean }) => {
      setSubmitError(null)

      // First, save the current builder tag to the benchmark (don't refetch yet)
      if (currentBuilderTag && !anonymous) {
        await updateBuilderTag.mutateAsync({
          benchmarkId,
          builderTag: currentBuilderTag,
          invalidate: false,
        })
      }

      const res = await api.submitBenchmark(benchmarkId, anonymous)
      if (!res || !res.success) {
        throw new Error(res?.error || t('Failed to submit benchmark'))
      }
      return res
    },
    onSuccess: () => {
      refetchLatest()
      queryClient.invalidateQueries({ queryKey: ['benchmark', 'history'] })
    },
    onError: (error: any) => {
      // Check if this is a 409 Conflict error (already submitted)
      if (error.status === 409) {
        setSubmitError(t('A benchmark for this system with the same or higher score has already been submitted.'))
      } else {
        setSubmitError(error.message)
      }
    },
  })

  // Check if the latest result is a full benchmark with AI data (eligible for sharing)
  // sharing needs a configured public leaderboard (off by default: upstream service)
  const canShareBenchmark =
    !!leaderboardUrl &&
    latestResult &&
    latestResult.benchmark_type === 'full' &&
    latestResult.ai_tokens_per_second !== null &&
    latestResult.ai_tokens_per_second > 0 &&
    !latestResult.submitted_to_repository

  // How to present the headline score: partial (System/AI Only) runs are NOT the
  // NOMAD Score and are relabelled + flagged so users don't mistake them for it.
  const scoreInfo = latestResult ? getScoreDisplay(latestResult.benchmark_type) : null

  // Handle Full Benchmark click with pre-flight check
  const handleFullBenchmarkClick = () => {
    if (!aiInstalled) {
      setShowAIRequiredAlert(true)
      return
    }
    setShowAIRequiredAlert(false)
    runBenchmark.mutate('full')
  }

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024)
    return `${gb.toFixed(1)} GB`
  }

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-desert-olive-dark'
    if (score >= 40) return 'text-desert-orange-dark'
    return 'text-desert-red-dark'
  }

  // Calculate AI score from tokens per second (normalized to 0-100)
  // Reference: 30 tok/s = 50 score, 60 tok/s = 100 score
  const getAIScore = (tokensPerSecond: number | null): number => {
    if (!tokensPerSecond) return 0
    const score = (tokensPerSecond / 60) * 100
    return Math.min(100, Math.max(0, score))
  }

  return (
    <SettingsLayout>
      <Head title={t('System Benchmark')} />
      <div className="xl:pl-72 w-full">
        <main className="px-6 lg:px-12 py-6 lg:py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-desert-green mb-2">{t('System Benchmark')}</h1>
            <p className="text-desert-stone-dark">
              {t("Measure your server's performance and compare with the community")}
            </p>
          </div>

          {/* Run Benchmark Section */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-desert-green mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-desert-green" />
              {t('Run Benchmark')}
            </h2>

            {isRunning ? (
              <BenchmarkRunView run={run} />
            ) : revealing ? (
              // Reveal slot: wait for the refetched latest result to be the one
              // from this run, then hand it to the score reveal.
              (() => {
                const ready =
                  latestResult && latestResult.benchmark_id === run.progress?.benchmark_id
                return ready ? (
                  <ScoreReveal result={latestResult} onDone={() => setRevealing(false)} />
                ) : (
                  <div className="bg-desert-white rounded-lg p-8 border border-desert-stone-light shadow-sm">
                    <div className="flex items-center justify-center gap-3 text-desert-green animate-pulse">
                      <div className="animate-spin h-6 w-6 border-2 border-desert-green border-t-transparent rounded-full" />
                      <span className="text-lg font-medium">{t('Compiling report...')}</span>
                    </div>
                  </div>
                )
              })()
            ) : (
              <div className="bg-desert-white rounded-lg p-8 border border-desert-stone-light shadow-sm">
                <div className="space-y-6">
                  {errorMsg && (
                    <Alert
                      type="error"
                      title={t('Benchmark Failed')}
                      message={errorMsg}
                      variant="bordered"
                      dismissible
                      onDismiss={() => setErrorMsg(null)}
                    />
                  )}
                  {showAIRequiredAlert && (
                    <Alert
                      type="warning"
                      title={t('{{name}} Required', { name: aiAssistantName })}
                      message={t('Full benchmark requires {{name}} to be installed. Install it to measure your complete system capability and share results with the community.', { name: aiAssistantName })}
                      variant="bordered"
                      dismissible
                      onDismiss={() => setShowAIRequiredAlert(false)}
                    >
                      <Link
                        href="/settings/apps"
                        className="text-sm text-desert-green hover:underline mt-2 inline-block font-medium"
                      >
                        {t('Go to Apps to install {{name}} →', { name: aiAssistantName })}
                      </Link>
                    </Alert>
                  )}
                  <p className="text-desert-stone-dark">
                    {t("Run a benchmark to measure your system's CPU, memory, disk, and AI inference performance. The benchmark takes approximately 3-6 minutes to complete.")}
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <StyledButton
                      onClick={handleFullBenchmarkClick}
                      disabled={runBenchmark.isPending}
                      icon="IconPlayerPlay"
                    >
                      {t('Run Full Benchmark')}
                    </StyledButton>
                    <StyledButton
                      variant="secondary"
                      onClick={() => runBenchmark.mutate('system')}
                      disabled={runBenchmark.isPending}
                      icon="IconCpu"
                    >
                      {t('System Only')}
                    </StyledButton>
                    <StyledButton
                      variant="secondary"
                      onClick={() => runBenchmark.mutate('ai')}
                      disabled={runBenchmark.isPending || !aiInstalled}
                      icon="IconWand"
                      title={
                        !aiInstalled
                          ? t('{{name}} must be installed to run AI benchmark', { name: aiAssistantName })
                          : undefined
                      }
                    >
                      {t('AI Only')}
                    </StyledButton>
                  </div>
                  {!aiInstalled && (
                    <p className="text-sm text-desert-stone-dark">
                      <span className="text-desert-orange-dark">{t('Note:')}</span>{' '}
                      {t('{{name}} is not installed.', { name: aiAssistantName })}
                      <Link
                        href="/settings/apps"
                        className="text-desert-green hover:underline ml-1"
                      >
                        {t('Install it')}
                      </Link>{' '}
                      {t('to run full benchmarks and share results with the community.')}
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Results Section */}
          {latestResult && (
            <>
              <section className="mb-12">
                <h2 className="text-2xl font-bold text-desert-green mb-6 flex items-center gap-2">
                  <div className="w-1 h-6 bg-desert-green" />
                  {t(scoreInfo?.label ?? 'NOMAD Score')}
                  {scoreInfo?.isPartial && (
                    <span className="ml-1 px-2 py-0.5 rounded-full bg-desert-stone-light text-desert-stone-dark text-xs font-semibold uppercase tracking-wide">
                      {t('Partial')}
                    </span>
                  )}
                </h2>

                <div className="bg-desert-white rounded-lg p-8 border border-desert-stone-light shadow-sm">
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="shrink-0">
                      <CircularGauge
                        value={latestResult.nomad_score}
                        label={latestResult.nomad_score_v2 != null ? t('Legacy Score') : t('NOMAD Score')}
                        size="lg"
                        variant="cpu"
                        subtext={t('out of 100')}
                        muted={scoreInfo?.isPartial}
                        icon={<IconChartBar className="w-8 h-8" />}
                      />
                    </div>
                    <div className="flex-1 space-y-4">
                      {latestResult.nomad_score_v2 != null ? (
                        <>
                          <div className="flex items-baseline gap-3">
                            <div className="text-5xl font-bold text-desert-green">
                              {latestResult.nomad_score_v2.toFixed(1)}
                            </div>
                            <div className="text-sm text-desert-stone-dark flex items-center gap-1">
                              {t('NOMAD Score')}
                              <InfoTooltip text={t('NOMAD Score v2 is an uncapped index versus the Reference Build, which scores exactly 1000. Higher is better, and there is no ceiling.')} />
                            </div>
                          </div>
                          <p className="text-sm text-desert-stone-dark">
                            {t('Reference Build = 1000.')}{' '}
                            <span className="text-desert-stone">
                              {t('Legacy scale: {{score}} / 100', { score: formatNumber(latestResult.nomad_score, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })}
                            </span>
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-3">
                        <div
                              className={`text-5xl font-bold ${
                            scoreInfo?.isPartial
                              ? 'text-desert-stone-dark'
                              : getScoreColor(latestResult.nomad_score)
                          }`}
                            >
                              {latestResult.nomad_score.toFixed(1)}
                            </div>
                        {scoreInfo?.isPartial && (
                          <span className="px-2 py-1 rounded-md bg-desert-stone-light text-desert-stone-dark text-xs font-semibold uppercase tracking-wide">
                            {t('Partial')}
                          </span>
                        )}
                      </div>
                          <p className="text-desert-stone-dark">
                            {scoreInfo?.isPartial
                          ? t(scoreInfo.cta)
                          : t('Your NOMAD Score is a weighted composite of all benchmark results.')}
                          </p>
                        </>
                      )}

                      {/* Share with Community - Only for full benchmarks with AI data */}
                      {canShareBenchmark && (
                        <div className="space-y-4 mt-6 pt-6 border-t border-desert-stone-light">
                          <h3 className="font-semibold text-desert-green">{t('Share with Community')}</h3>
                          <p className="text-sm text-desert-stone-dark">
                            {t('Share your benchmark on the community leaderboard. Choose a Builder Tag to claim your spot, or share anonymously.')}
                          </p>

                          {/* Builder Tag Selector */}
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-desert-stone-dark">
                              {t('Your Builder Tag')}
                            </label>
                            <BuilderTagSelector
                              value={currentBuilderTag}
                              onChange={setCurrentBuilderTag}
                              disabled={shareAnonymously || submitResult.isPending}
                            />
                          </div>

                          {/* Anonymous checkbox */}
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={shareAnonymously}
                              onChange={(e) => setShareAnonymously(e.target.checked)}
                              disabled={submitResult.isPending}
                              className="w-4 h-4 rounded border-desert-stone-light text-desert-green focus:ring-desert-green"
                            />
                            <span className="text-sm text-desert-stone-dark">
                              {t('Share anonymously (no Builder Tag shown on leaderboard)')}
                            </span>
                          </label>

                          <StyledButton
                            onClick={() =>
                              submitResult.mutate({
                                benchmarkId: latestResult.benchmark_id,
                                anonymous: shareAnonymously,
                              })
                            }
                            disabled={submitResult.isPending}
                            icon="IconCloudUpload"
                          >
                            {submitResult.isPending ? t('Submitting...') : t('Share with Community')}
                          </StyledButton>
                          {submitError && (
                            <Alert
                              type="error"
                              title={t('Submission Failed')}
                              message={submitError}
                              variant="bordered"
                              dismissible
                              onDismiss={() => setSubmitError(null)}
                            />
                          )}
                        </div>
                      )}

                      {/* Show message for partial benchmarks */}
                      {latestResult &&
                        !latestResult.submitted_to_repository &&
                        !canShareBenchmark && (
                          <Alert
                            type="info"
                            title={t('Partial Benchmark')}
                            message={t('This {{type}} benchmark cannot be shared with the community. Run a Full Benchmark with {{name}} installed to share your results.', { type: t(latestResult.benchmark_type), name: aiAssistantName })}
                            variant="bordered"
                          />
                        )}

                      {latestResult.submitted_to_repository && leaderboardUrl && (
                        <Alert
                          type="success"
                          title={t('Shared with Community')}
                          message={t('Your benchmark has been submitted to the community leaderboard. Thanks for contributing!')}
                          variant="bordered"
                        >
                          <a
                            href={leaderboardUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-desert-green hover:underline mt-2 inline-block"
                          >
                            {t('View the leaderboard →')}
                          </a>
                        </Alert>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="mb-12">
                <h2 className="text-2xl font-bold text-desert-green mb-6 flex items-center gap-2">
                  <div className="w-1 h-6 bg-desert-green" />
                  {t('System Performance')}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-desert-white rounded-lg p-6 border border-desert-stone-light shadow-sm">
                    <CircularGauge
                      value={latestResult.cpu_score * 100}
                      label={t('CPU')}
                      size="md"
                      variant="cpu"
                      icon={<IconCpu className="w-6 h-6" />}
                    />
                  </div>
                  <div className="bg-desert-white rounded-lg p-6 border border-desert-stone-light shadow-sm">
                    <CircularGauge
                      value={latestResult.memory_score * 100}
                      label={t('Memory')}
                      size="md"
                      variant="memory"
                      icon={<IconDatabase className="w-6 h-6" />}
                    />
                  </div>
                  <div className="bg-desert-white rounded-lg p-6 border border-desert-stone-light shadow-sm">
                    <CircularGauge
                      value={latestResult.disk_read_score * 100}
                      label={t('Disk Read')}
                      size="md"
                      variant="disk"
                      icon={<IconServer className="w-6 h-6" />}
                    />
                  </div>
                  <div className="bg-desert-white rounded-lg p-6 border border-desert-stone-light shadow-sm">
                    <CircularGauge
                      value={latestResult.disk_write_score * 100}
                      label={t('Disk Write')}
                      size="md"
                      variant="disk"
                      icon={<IconServer className="w-6 h-6" />}
                    />
                  </div>
                </div>
              </section>

              {/* AI Performance Section */}
              <section className="mb-12">
                <h2 className="text-2xl font-bold text-desert-green mb-6 flex items-center gap-2">
                  <div className="w-1 h-6 bg-desert-green" />
                  {t('AI Performance')}
                </h2>

                {latestResult.ai_tokens_per_second ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-desert-white rounded-lg p-6 border border-desert-stone-light shadow-sm">
                      <CircularGauge
                        value={getAIScore(latestResult.ai_tokens_per_second)}
                        label={t('AI Score')}
                        size="md"
                        variant="cpu"
                        icon={<IconRobot className="w-6 h-6" />}
                      />
                    </div>
                    <div className="bg-desert-white rounded-lg p-6 border border-desert-stone-light shadow-sm flex items-center justify-center">
                      <div className="flex items-center gap-4">
                        <IconRobot className="w-10 h-10 text-desert-green" />
                        <div>
                          <div className="text-3xl font-bold text-desert-green">
                            {latestResult.ai_tokens_per_second.toFixed(1)}
                          </div>
                          <div className="text-sm text-desert-stone-dark flex items-center gap-1">
                            {t('Tokens per Second')}
                            <InfoTooltip text={t('How fast the AI generates text. Higher is better. 30+ tokens/sec feels responsive, 60+ feels instant.')} />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-desert-white rounded-lg p-6 border border-desert-stone-light shadow-sm flex items-center justify-center">
                      <div className="flex items-center gap-4">
                        <IconRobot className="w-10 h-10 text-desert-green" />
                        <div>
                          <div className="text-3xl font-bold text-desert-green">
                            {latestResult.ai_time_to_first_token?.toFixed(0) || t('N/A')} ms
                          </div>
                          <div className="text-sm text-desert-stone-dark flex items-center gap-1">
                            {t('Time to First Token')}
                            <InfoTooltip text={t('How quickly the AI starts responding after you send a message. Lower is better. Under 500ms feels instant.')} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-desert-white rounded-lg p-6 border border-desert-stone-light shadow-sm">
                    <div className="text-center text-desert-stone-dark">
                      <IconRobot className="w-12 h-12 mx-auto mb-3 opacity-40" />
                      <p className="font-medium">{t('No AI Benchmark Data')}</p>
                      <p className="text-sm mt-1">
                        {t('Run a Full Benchmark or AI Only benchmark to measure AI inference performance.')}
                      </p>
                    </div>
                  </div>
                )}
              </section>

              <section className="mb-12">
                <h2 className="text-2xl font-bold text-desert-green mb-6 flex items-center gap-2">
                  <div className="w-1 h-6 bg-desert-green" />
                  {t('Hardware Information')}
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <InfoCard
                    title={t('Processor')}
                    icon={<IconCpu className="w-6 h-6" />}
                    variant="elevated"
                    data={[
                      { label: t('Model'), value: latestResult.cpu_model },
                      { label: t('Cores'), value: latestResult.cpu_cores },
                      { label: t('Threads'), value: latestResult.cpu_threads },
                    ]}
                  />
                  <InfoCard
                    title={t('System')}
                    icon={<IconServer className="w-6 h-6" />}
                    variant="elevated"
                    data={[
                      { label: 'RAM', value: formatBytes(latestResult.ram_bytes) },
                      { label: t('Disk Type'), value: latestResult.disk_type.toUpperCase() },
                      { label: 'GPU', value: latestResult.gpu_model || t('Not detected') },
                    ]}
                  />
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-desert-green mb-6 flex items-center gap-2">
                  <div className="w-1 h-6 bg-desert-green" />
                  {t('Benchmark Details')}
                </h2>

                <div className="bg-desert-white rounded-lg border border-desert-stone-light shadow-sm overflow-hidden">
                  {/* Summary row - always visible */}
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="w-full p-6 flex items-center justify-between hover:bg-desert-stone-lighter/30 transition-colors"
                  >
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-left flex-1">
                      <div>
                        <div className="text-desert-stone-dark">{t('Benchmark ID')}</div>
                        <div className="font-mono text-xs">
                          {latestResult.benchmark_id.slice(0, 8)}...
                        </div>
                      </div>
                      <div>
                        <div className="text-desert-stone-dark">{t('Type')}</div>
                        <div className="capitalize">{t(latestResult.benchmark_type)}</div>
                      </div>
                      <div>
                        <div className="text-desert-stone-dark">{t('Date')}</div>
                        <div>
                          {formatDate(latestResult.created_at as unknown as string)}
                        </div>
                      </div>
                      <div>
                        <div className="text-desert-stone-dark">{t('NOMAD Score')}</div>
                        <div className="font-bold text-desert-green">
                          {(latestResult.nomad_score_v2 ?? latestResult.nomad_score).toFixed(1)}
                        </div>
                      </div>
                    </div>
                    <IconChevronDown
                      className={`w-5 h-5 text-desert-stone-dark transition-transform ${showDetails ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* Expanded details */}
                  {showDetails && (
                    <div className="border-t border-desert-stone-light p-6 bg-desert-stone-lighter/20">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Raw Scores */}
                        <div>
                          <h4 className="font-semibold text-desert-green mb-3">{t('Raw Scores')}</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-desert-stone-dark">{t('CPU Score')}</span>
                              <span className="font-mono">
                                {(latestResult.cpu_score * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-desert-stone-dark">{t('Memory Score')}</span>
                              <span className="font-mono">
                                {(latestResult.memory_score * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-desert-stone-dark">{t('Disk Read Score')}</span>
                              <span className="font-mono">
                                {(latestResult.disk_read_score * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-desert-stone-dark">{t('Disk Write Score')}</span>
                              <span className="font-mono">
                                {(latestResult.disk_write_score * 100).toFixed(1)}%
                              </span>
                            </div>
                            {latestResult.ai_tokens_per_second && (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-desert-stone-dark">{t('AI Tokens/sec')}</span>
                                  <span className="font-mono">
                                    {latestResult.ai_tokens_per_second.toFixed(1)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-desert-stone-dark">
                                    {t('AI Time to First Token')}
                                  </span>
                                  <span className="font-mono">
                                    {latestResult.ai_time_to_first_token?.toFixed(0) || t('N/A')} ms
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Benchmark Info */}
                        <div>
                          <h4 className="font-semibold text-desert-green mb-3">{t('Benchmark Info')}</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-desert-stone-dark">{t('Full Benchmark ID')}</span>
                              <span className="font-mono text-xs">{latestResult.benchmark_id}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-desert-stone-dark">{t('Benchmark Type')}</span>
                              <span className="capitalize">{t(latestResult.benchmark_type)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-desert-stone-dark">{t('Run Date')}</span>
                              <span>
                                {formatDateTime(latestResult.created_at as unknown as string)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-desert-stone-dark">{t('Builder Tag')}</span>
                              <span className="font-mono">
                                {latestResult.builder_tag || t('Not set')}
                              </span>
                            </div>
                            {latestResult.ai_model_used && (
                              <div className="flex justify-between">
                                <span className="text-desert-stone-dark">{t('AI Model Used')}</span>
                                <span>{latestResult.ai_model_used}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-desert-stone-dark">
                                {t('Submitted to Repository')}
                              </span>
                              <span>{latestResult.submitted_to_repository ? t('Yes') : t('No')}</span>
                            </div>
                            {latestResult.repository_id && (
                              <div className="flex justify-between">
                                <span className="text-desert-stone-dark">{t('Repository ID')}</span>
                                <span className="font-mono text-xs">
                                  {latestResult.repository_id}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* v2 raw measurements + run environment */}
                      {latestResult.cpu_events_multi != null && (
                        <div className="mt-6 pt-6 border-t border-desert-stone-light grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-semibold text-desert-green mb-3">
                              {t('Measured Performance (v2)')}
                            </h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-desert-stone-dark">{t('CPU single-thread')}</span>
                                <span className="font-mono">
                                  {latestResult.cpu_events_single?.toFixed(1)} {t('events/s')}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-desert-stone-dark">
                                  {t('CPU multi-thread ({{threads}}T)', { threads: latestResult.cpu_benchmark_threads })}
                                </span>
                                <span className="font-mono">
                                  {latestResult.cpu_events_multi?.toFixed(1)} {t('events/s')}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-desert-stone-dark">
                                  {t('Memory ({{threads}}T)', { threads: latestResult.memory_threads })}
                                </span>
                                <span className="font-mono">
                                  {formatNumber(latestResult.memory_ops_per_sec)} ops/s
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-desert-stone-dark">
                                  {t('Disk read (O_DIRECT)')}
                                </span>
                                <span className="font-mono">
                                  {latestResult.disk_read_mb_per_sec?.toFixed(1)} MB/s
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-desert-stone-dark">
                                  {t('Disk write (O_DIRECT)')}
                                </span>
                                <span className="font-mono">
                                  {latestResult.disk_write_mb_per_sec?.toFixed(1)} MB/s
                                </span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-semibold text-desert-green mb-3">{t('Environment')}</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-desert-stone-dark">{t('Run environment')}</span>
                                <span className="font-mono">
                                  {latestResult.run_environment || t('Unknown')}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-desert-stone-dark">{t('Storage backend')}</span>
                                <span className="font-mono">
                                  {latestResult.storage_path_type || t('Unknown')}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-desert-stone-dark">{t('GPU compute')}</span>
                                <span className="font-mono">
                                  {latestResult.gpu_compute_detected == null
                                    ? t('Unknown')
                                    : latestResult.gpu_compute_detected
                                      ? t('Detected')
                                      : t('Not detected')}
                                </span>
                              </div>
                              {latestResult.sysbench_digest && (
                                <div className="flex justify-between">
                                  <span className="text-desert-stone-dark">sysbench</span>
                                  <span className="font-mono text-xs">
                                    {latestResult.sysbench_digest.replace('sha256:', '').slice(0, 12)}
                                  </span>
                                </div>
                              )}
                              {latestResult.ollama_version && (
                                <div className="flex justify-between">
                                  <span className="text-desert-stone-dark">Ollama</span>
                                  <span className="font-mono text-xs">
                                    {latestResult.ollama_version}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* Benchmark History */}
              {benchmarkHistory && benchmarkHistory.length > 1 && (
                <section className="mb-12">
                  <h2 className="text-2xl font-bold text-desert-green mb-6 flex items-center gap-2">
                    <div className="w-1 h-6 bg-desert-green" />
                    {t('Benchmark History')}
                  </h2>

                  <div className="bg-desert-white rounded-lg border border-desert-stone-light shadow-sm overflow-hidden">
                    <button
                      onClick={() => setShowHistory(!showHistory)}
                      className="w-full p-4 flex items-center justify-between hover:bg-desert-stone-lighter/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <IconClock className="w-5 h-5 text-desert-stone-dark" />
                        <span className="font-medium text-desert-green">
                          {benchmarkHistory.length === 1
                            ? t('1 benchmark recorded')
                            : t('{{count}} benchmarks recorded', { count: benchmarkHistory.length })}
                        </span>
                      </div>
                      <IconChevronDown
                        className={`w-5 h-5 text-desert-stone-dark transition-transform ${showHistory ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {showHistory && (
                      <div className="border-t border-desert-stone-light">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-desert-stone-lighter/50">
                              <tr>
                                <th className="text-left p-3 font-medium text-desert-stone-dark">
                                  {t('Date')}
                                </th>
                                <th className="text-left p-3 font-medium text-desert-stone-dark">
                                  {t('Type')}
                                </th>
                                <th className="text-left p-3 font-medium text-desert-stone-dark">
                                  {t('Score')}
                                </th>
                                <th className="text-left p-3 font-medium text-desert-stone-dark">
                                  {t('Builder Tag')}
                                </th>
                                <th className="text-left p-3 font-medium text-desert-stone-dark">
                                  {t('Shared')}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-desert-stone-lighter">
                              {benchmarkHistory.map((result) => (
                                <tr
                                  key={result.benchmark_id}
                                  className={`hover:bg-desert-stone-lighter/30 ${
                                    result.benchmark_id === latestResult?.benchmark_id
                                      ? 'bg-desert-green/5'
                                      : ''
                                  }`}
                                >
                                  <td className="p-3">
                                    {formatDate(result.created_at as unknown as string)}
                                  </td>
                                  <td className="p-3 capitalize">{t(result.benchmark_type)}</td>
                                  {/*
                                    Show the v2 score when the run has one.

                                    This column rendered nomad_score for every
                                    row, so a v2 run showed its legacy score
                                    while the Benchmark Details card directly
                                    above showed the v2 one. The same run read
                                    as 65.0 here and 1036.1 there.

                                    Rows predating v2 have no v2 score and can
                                    only show the legacy number, so the two
                                    scales end up in one column. They differ by
                                    more than 10x, and without the scale on
                                    screen a v2 run next to older runs reads as
                                    a collapse rather than a rescale. The "/ 100"
                                    suffix names the legacy scale in place,
                                    matching the wording the details card
                                    already uses.
                                  */}
                                  <td className="p-3">
                                    <span className="font-bold text-desert-green">
                                      {(result.nomad_score_v2 ?? result.nomad_score).toFixed(1)}
                                    </span>
                                    {result.nomad_score_v2 == null && (
                                      <span className="ml-1 text-xs text-desert-stone-dark">
                                        / 100
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3 font-mono text-xs">
                                    {result.builder_tag || '—'}
                                  </td>
                                  <td className="p-3">
                                    {result.submitted_to_repository ? (
                                      <span className="text-desert-olive-dark">✓</span>
                                    ) : (
                                      <span className="text-desert-stone-dark">—</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </>
          )}

          {!latestResult && !isRunning && (
            <Alert
              type="info"
              title={t('No Benchmark Results')}
              message={t("Run your first benchmark to see your server's performance scores.")}
              variant="bordered"
            />
          )}
        </main>
      </div>
    </SettingsLayout>
  )
}
