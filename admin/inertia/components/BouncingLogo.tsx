import { useState, useEffect } from 'react'
import UbuntuLogo from './UbuntuLogo'
import { useTranslation } from 'react-i18next'

// Fading Image Component
const FadingImage = ({ alt, className = '' }: { alt?: string; className?: string }) => {
  const { t } = useTranslation()
  const [isVisible, setIsVisible] = useState(true)
  const [shouldShow, setShouldShow] = useState(true)

  useEffect(() => {
    // Start fading out after 2 seconds
    const fadeTimer = setTimeout(() => {
      setIsVisible(false)
    }, 2000)

    // Remove from DOM after fade out completes
    const removeTimer = setTimeout(() => {
      setShouldShow(false)
    }, 3000)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(removeTimer)
    }
  }, [])

  if (!shouldShow) {
    return null
  }

  return (
    <div
      className={`fixed inset-0 flex justify-center items-center bg-desert-sand z-50 pointer-events-none transition-opacity duration-1000 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <UbuntuLogo
        grid={21}
        title={alt ?? t('Fading image')}
        className={`w-64 h-64 text-text-primary ${className}`}
      />
    </div>
  )
}

export default FadingImage
