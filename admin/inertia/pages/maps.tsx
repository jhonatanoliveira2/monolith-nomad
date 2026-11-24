import { useState } from 'react'
import { Head, Link, router } from '@inertiajs/react'

import MapsLayout from '~/layouts/MapsLayout'
import MapComponent from '~/components/maps/MapComponent'
import StyledButton from '~/components/StyledButton'
import { IconArrowLeft, IconCrosshair, IconMapPin, IconPlaneTilt } from '@tabler/icons-react'
import { FileEntry } from '../../types/files'
import Alert from '~/components/Alert'
import { useTranslation } from 'react-i18next'

type MapCommand = {
  id: number
  lat: number
  lng: number
  action: 'fly' | 'marker'
}

export default function Maps(props: {
  maps: { baseAssetsExist: boolean; worldBasemapExists: boolean; regionFiles: FileEntry[] }
}) {
  const { t } = useTranslation()
  const [isHoveringUI, setIsHoveringUI] = useState(false)

  const [coordinateSearch, setCoordinateSearch] = useState('')
  const [mapCommand, setMapCommand] = useState<MapCommand | null>(null)
  const [showCoordinatesEnabled, setShowCoordinatesEnabled] = useState(true)

  const parseCoordinates = () => {
    const [latRaw, lngRaw] = coordinateSearch.split(',').map((value) => value.trim())
    const lat = Number(latRaw)
    const lng = Number(lngRaw)

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return null
    }

    return { lat, lng }
  }

  const handleCoordinateAction = (action: 'fly' | 'marker') => {
    const coordinates = parseCoordinates()
    if (!coordinates) return

    setMapCommand({
      id: Date.now(),
      ...coordinates,
      action,
    })
  }

  const alertMessage = !props.maps.baseAssetsExist
    ? t(
        'The base map assets have not been installed. Please download them first to enable map functionality.'
      )
    : !props.maps.worldBasemapExists
      ? t(
          'The world base map has not been downloaded yet, so the map may appear blank outside downloaded regions. Connect this monolith-nomad to the internet and download it (~15 MB) from Map Settings.'
        )
      : props.maps.regionFiles.length === 0
        ? t(
            'No map regions have been downloaded yet. Please download some regions to enable map functionality.'
          )
        : null

  return (
    <MapsLayout>
      <Head title={t('Maps')} />

      <div className="relative w-full h-screen overflow-hidden">
        {/* Navbar */}
        <div
          className="absolute top-0 left-0 right-0 z-50 flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 nd-glass border-b border-border-subtle"
          onMouseEnter={() => setIsHoveringUI(true)}
          onMouseLeave={() => setIsHoveringUI(false)}
        >
          <Link
            href="/home"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-text-secondary hover:bg-surface-elevated hover:text-text-primary lg:hidden"
          >
            <IconArrowLeft size={16} />
            {t('Back to Home')}
          </Link>
          <p className="hidden lg:flex items-center gap-2 nd-eyebrow px-2">
            <span className="nd-led text-led" aria-hidden="true" />
            {t('Maps')}
          </p>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="lat,lng"
              value={coordinateSearch}
              onChange={(event) => setCoordinateSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleCoordinateAction('fly')
              }}
              className="nd-field !w-44 sm:!w-52 !py-1.5 nd-mono !text-xs"
              aria-label={t('Coordinates (lat,lng)')}
            />

            <button
              type="button"
              onClick={() => handleCoordinateAction('fly')}
              className="inline-flex size-9 items-center justify-center rounded-full border border-border-default bg-surface-primary text-text-secondary hover:border-text-muted hover:text-text-primary cursor-pointer"
              title={t('Fly to coordinates')}
              aria-label={t('Fly to coordinates')}
            >
              <IconPlaneTilt size={18} />
            </button>

            <button
              type="button"
              onClick={() => handleCoordinateAction('marker')}
              className="inline-flex size-9 items-center justify-center rounded-full border border-border-default bg-surface-primary text-text-secondary hover:border-text-muted hover:text-text-primary cursor-pointer"
              title={t('Add marker at coordinates')}
              aria-label={t('Add marker at coordinates')}
            >
              <IconMapPin size={18} />
            </button>

            <button
              type="button"
              onClick={() => setShowCoordinatesEnabled((prev) => !prev)}
              className={`inline-flex size-9 items-center justify-center rounded-full border transition-colors cursor-pointer ${
                showCoordinatesEnabled
                  ? 'bg-accent text-accent-contrast border-accent'
                  : 'border-border-default bg-surface-primary text-text-secondary hover:border-text-muted hover:text-text-primary'
              }`}
              aria-pressed={showCoordinatesEnabled}
              title={showCoordinatesEnabled ? t('Hide coordinates') : t('Show coordinates')}
              aria-label={showCoordinatesEnabled ? t('Hide coordinates') : t('Show coordinates')}
            >
              <IconCrosshair size={18} />
            </button>

            <Link href="/settings/maps">
              <StyledButton variant="primary" icon="IconSettings" size="sm">
                {t('Manage Map Regions')}
              </StyledButton>
            </Link>
          </div>
        </div>

        {/* Alert */}
        {alertMessage && (
          <div
            className="absolute top-20 left-4 right-4 z-50"
            onMouseEnter={() => setIsHoveringUI(true)}
            onMouseLeave={() => setIsHoveringUI(false)}
          >
            <Alert
              title={alertMessage}
              type="warning"
              variant="solid"
              className="w-full"
              buttonProps={{
                variant: 'secondary',
                children: t('Go to Map Settings'),
                icon: 'IconSettings',
                onClick: () => router.visit('/settings/maps'),
              }}
            />
          </div>
        )}

        {/* Map */}

        <div className="absolute inset-0">
          <MapComponent
            mapCommand={mapCommand}
            isHoveringUI={isHoveringUI}
            showCoordinatesEnabled={showCoordinatesEnabled}
          />
        </div>
      </div>
    </MapsLayout>
  )
}
