import { IconAlertTriangle } from '@tabler/icons-react'
import { Trans, useTranslation } from 'react-i18next'

/**
 * "When to use what" — top-of-page safety banner.
 *
 * A prominent amber callout that renders at the TOP of both the condition index
 * and detail pages: results are FDA label-indication matches, NOT
 * recommendations, NOT an FDA endorsement, and NOT a drug-interaction checker.
 * It leads the page (not a footnote) so the caveat is read before any result.
 */
export default function SafetyBanner() {
  const { t } = useTranslation()
  return (
    <div
      role="alert"
      className="mb-6 rounded-xl border border-desert-orange bg-desert-orange-lighter p-4"
    >
      <div className="flex items-start gap-3">
        <IconAlertTriangle
          size={22}
          className="mt-0.5 flex-shrink-0 text-desert-orange-dark"
          aria-hidden="true"
        />
        <div className="text-sm text-desert-orange-dark">
          <p className="font-bold mb-1">
            {t('Informational reference only — not medical advice.')}
          </p>
          <ul className="list-disc pl-5 space-y-0.5 text-desert-orange-dark">
            <li>
              <Trans
                i18nKey="These results match FDA drug-label indications to a situation. They are <strong>not a recommendation</strong> and <strong>not an FDA endorsement</strong>."
                components={{ strong: <strong /> }}
              />
            </li>
            <li>
              <Trans
                i18nKey="This is <strong>not a drug-interaction checker</strong>. Read each label’s full warnings, and check with a pharmacist or clinician before combining medicines."
                components={{ strong: <strong /> }}
              />
            </li>
            <li>
              <Trans
                i18nKey="In an emergency, or if symptoms are severe or worsening, <strong>contact a medical professional or call emergency services</strong>."
                components={{ strong: <strong /> }}
              />
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
