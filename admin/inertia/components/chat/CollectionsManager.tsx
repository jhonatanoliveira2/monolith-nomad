import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import StyledModal from '../StyledModal'
import StyledButton from '~/components/StyledButton'
import { useNotifications } from '~/context/NotificationContext'
import api from '~/lib/api'
import { useTranslation } from 'react-i18next'

interface CollectionsManagerProps {
  onClose: () => void
}

export default function CollectionsManager({ onClose }: CollectionsManagerProps) {
  const { t } = useTranslation()
  const { addNotification } = useNotifications()
  const queryClient = useQueryClient()
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ['kbCollections'],
    queryFn: () => api.getKnowledgeCollections(),
    select: (data) => data?.collections ?? [],
  })

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['kbCollections'] })
    queryClient.invalidateQueries({ queryKey: ['storedFiles'] })
  }

  const renameMutation = useMutation({
    mutationFn: ({ oldName, newName }: { oldName: string; newName: string }) =>
      api.renameCollection(oldName, newName),
    onSuccess: (data) => {
      addNotification({ type: 'success', message: data?.message || t('Collection renamed.') })
      setEditingName(null)
      invalidateAll()
    },
    onError: (error: any) => {
      addNotification({ type: 'error', message: error?.message || t('Failed to rename collection.') })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => api.deleteCollection(name),
    onSuccess: (data) => {
      addNotification({ type: 'success', message: data?.message || t('Collection removed.') })
      setConfirmDelete(null)
      invalidateAll()
    },
    onError: (error: any) => {
      addNotification({ type: 'error', message: error?.message || t('Failed to remove collection.') })
    },
  })

  return (
    <StyledModal
      open={true}
      title={t('Manage Collections')}
      onClose={onClose}
      cancelText={t('Close')}
      onCancel={onClose}
      large
    >
      <div className="text-left">
        <p className="text-sm text-text-secondary mb-4">
          {t("Rename or remove collections. Removing a collection doesn't delete any files — they're simply moved back to Uncategorized so you can re-sort them.")}
        </p>

        {isLoading && <p className="text-sm text-text-muted">{t('Loading…')}</p>}
        {!isLoading && collections.length === 0 && (
          <p className="text-sm text-text-muted">
            {t('No collections yet. Assign a file to a collection from the Knowledge Base table to create one.')}
          </p>
        )}

        <ul className="divide-y divide-border-subtle">
          {collections.map((name) => (
            <li key={name} className="flex items-center justify-between gap-3 py-3">
              {editingName === name ? (
                <>
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="flex-1 rounded border border-border-subtle bg-surface-primary px-2 py-1 text-sm text-text-primary"
                  />
                  <StyledButton
                    variant="primary"
                    icon="IconCheck"
                    loading={renameMutation.isPending}
                    disabled={!editValue.trim() || editValue.trim() === name}
                    onClick={() =>
                      renameMutation.mutate({ oldName: name, newName: editValue.trim() })
                    }
                  >
                    {t('Save')}
                  </StyledButton>
                  <StyledButton variant="outline" onClick={() => setEditingName(null)}>
                    {t('Cancel')}
                  </StyledButton>
                </>
              ) : confirmDelete === name ? (
                <>
                  <span className="flex-1 text-sm text-text-primary">
                    {t('Remove "{{name}}"? Files move to Uncategorized.', { name })}
                  </span>
                  <StyledButton
                    variant="danger"
                    icon="IconTrash"
                    loading={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(name)}
                  >
                    {t('Confirm')}
                  </StyledButton>
                  <StyledButton variant="outline" onClick={() => setConfirmDelete(null)}>
                    {t('Cancel')}
                  </StyledButton>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-text-primary">{name}</span>
                  <StyledButton
                    variant="secondary"
                    icon="IconPencil"
                    onClick={() => {
                      setEditingName(name)
                      setEditValue(name)
                    }}
                  >
                    {t('Rename')}
                  </StyledButton>
                  <StyledButton
                    variant="danger"
                    icon="IconTrash"
                    onClick={() => setConfirmDelete(name)}
                  >
                    {t('Remove')}
                  </StyledButton>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </StyledModal>
  )
}
