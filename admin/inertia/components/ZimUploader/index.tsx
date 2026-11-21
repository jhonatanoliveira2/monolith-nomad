import Uppy, { type Body, type Meta, type UploadResult } from '@uppy/core'
import Dashboard from '@uppy/react/dashboard'
import XHRUpload from '@uppy/xhr-upload'
import '@uppy/core/css/style.min.css'
import '@uppy/dashboard/css/style.min.css'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { t as translate } from '~/lib/i18n'

/**
 * Translated strings for the visible parts of the Uppy Dashboard (the rest stays in Uppy's English).
 * Built when the Uppy instance is created, so it follows the interface language at that moment.
 * %{...} placeholders are Uppy's own interpolation and must be kept verbatim in the catalog.
 */
export function uppyLocale() {
  const t = translate
  return {
    strings: {
      dropPasteFiles: t('Drop files here or %{browseFiles}'),
      browseFiles: t('browse files'),
      dropHint: t('Drop your files here'),
      myDevice: t('My Device'),
      addMore: t('Add more'),
      addMoreFiles: t('Add more files'),
      addingMoreFiles: t('Adding more files'),
      back: t('Back'),
      cancel: t('Cancel'),
      done: t('Done'),
      retry: t('Retry'),
      pause: t('Pause'),
      resume: t('Resume'),
      upload: t('Upload'),
      uploading: t('Uploading'),
      complete: t('Complete'),
      uploadComplete: t('Upload complete'),
      uploadFailed: t('Upload failed'),
      uploadPaused: t('Upload paused'),
      paused: t('Paused'),
      error: t('Error'),
      removeFile: t('Remove file'),
      retryUpload: t('Retry upload'),
      cancelUpload: t('Cancel upload'),
      pauseUpload: t('Pause upload'),
      resumeUpload: t('Resume upload'),
      showErrorDetails: t('Show error details'),
      xTimeLeft: t('%{time} left'),
      dataUploadedOfTotal: t('%{complete} of %{total}'),
      failedToUpload: t('Failed to upload %{file}'),
      exceedsSize: t('%{file} exceeds maximum allowed size of %{size}'),
      youCanOnlyUploadFileTypes: t('You can only upload: %{types}'),
      noDuplicates: t("Cannot add the duplicate file '%{fileName}', it already exists"),
      noMoreFilesAllowed: t('Cannot add more files'),
      xFilesSelected: { 0: t('%{smart_count} file selected'), 1: t('%{smart_count} files selected') },
      uploadingXFiles: { 0: t('Uploading %{smart_count} file'), 1: t('Uploading %{smart_count} files') },
      uploadXFiles: { 0: t('Upload %{smart_count} file'), 1: t('Upload %{smart_count} files') },
      uploadXNewFiles: { 0: t('Upload +%{smart_count} file'), 1: t('Upload +%{smart_count} files') },
      youCanOnlyUploadX: {
        0: t('You can only upload %{smart_count} file'),
        1: t('You can only upload %{smart_count} files'),
      },
      youHaveToAtLeastSelectX: {
        0: t('You have to select at least %{smart_count} file'),
        1: t('You have to select at least %{smart_count} files'),
      },
    },
    pluralize: (count: number) => (count === 1 ? 0 : 1),
  }
}

interface ZimUploaderProps {
  onUploadComplete: (added: number) => void
  existingFilenames: string[]
}

export default function ZimUploader({ onUploadComplete, existingFilenames }: ZimUploaderProps) {
  const { t } = useTranslation()
  const existingFilenamesRef = useRef(existingFilenames)
  useEffect(() => {
    existingFilenamesRef.current = existingFilenames
  }, [existingFilenames])

  // Keep the latest callback in a ref so the Uppy lifecycle effect below does
  // not depend on it. The parent passes a new inline function on every render,
  // and if that identity were in the effect deps, a re-render mid-upload (e.g.
  // a window-focus refetch) would tear down and `uppy.destroy()` the instance,
  // aborting the in-flight upload.
  const onUploadCompleteRef = useRef(onUploadComplete)
  useEffect(() => {
    onUploadCompleteRef.current = onUploadComplete
  }, [onUploadComplete])

  const [uppy] = useState(() =>
    new Uppy<Meta, Body>({
      restrictions: {
        maxNumberOfFiles: 5,
        allowedFileTypes: ['.zim'],
      },
      autoProceed: false,
      locale: uppyLocale(),
    }).use(XHRUpload, {
      endpoint: '/api/zim/upload',
      fieldName: 'file',
      // Uppy 5 dropped getResponseError: an error thrown here fails the upload with this message
      // (the server's own `message` when it sent one) instead of a bare status text.
      onAfterResponse: (xhr: XMLHttpRequest) => {
        if (xhr.status >= 200 && xhr.status < 300) return
        let message = translate('Upload failed')
        try {
          const body = JSON.parse(xhr.responseText)
          if (body?.message) message = body.message
        } catch {}
        throw new Error(message)
      },
    })
  )

  useEffect(() => {
    const handleFileAdded = (file: { id: string; name: string }) => {
      if (existingFilenamesRef.current.includes(file.name)) {
        uppy.removeFile(file.id)
        uppy.info(translate('A ZIM file with that name already exists'), 'error', 6000)
        return
      }

      const isWikipedia = (name: string) => name.startsWith('wikipedia_en_')
      if (isWikipedia(file.name)) {
        const alreadyQueued = uppy.getFiles().some((f) => f.id !== file.id && isWikipedia(f.name))
        if (alreadyQueued) {
          uppy.removeFile(file.id)
          uppy.info(translate('Only one Wikipedia file can be uploaded at a time'), 'error', 6000)
        }
      }
    }
    const handleComplete = (result: UploadResult<Meta, Body>) => {
      // Uppy emits `complete` even when uploads fail or are aborted. Only treat
      // the run as a success when nothing failed — otherwise leave the uploader
      // open so the Dashboard can surface the error instead of closing it with a
      // false "Upload complete" toast.
      if ((result.failed ?? []).length > 0) return
      const added = (result.successful ?? []).reduce(
        (sum, f) => sum + Number((f.response?.body as { added?: number } | undefined)?.added ?? 0),
        0
      )
      onUploadCompleteRef.current(added)
    }
    uppy.on('file-added', handleFileAdded)
    uppy.on('complete', handleComplete)
    return () => {
      uppy.off('file-added', handleFileAdded)
      uppy.off('complete', handleComplete)
      uppy.destroy()
    }
  }, [uppy])

  return (
    <Dashboard
      uppy={uppy}
      width="100%"
      height={300}
      note={t(
        'ZIM files only. Large files (up to 20 GB) are supported. For best results, upload from the same machine or over a stable LAN connection. Larger files should be copied directly to the storage volume'
      )}
    />
  )
}
