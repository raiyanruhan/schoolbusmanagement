import { ConfirmationDialog } from '@primer/react'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

export default function ConfirmDialog({
  open, onClose, onConfirm, title, message,
  confirmLabel = 'Confirm', danger = false
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <ConfirmationDialog
      title={title}
      onClose={(gesture) => {
        if (gesture === 'confirm') {
          onConfirm()
        }
        onClose()
      }}
      confirmButtonType={danger ? 'danger' : 'normal'}
      confirmButtonContent={confirmLabel}
    >
      {message}
    </ConfirmationDialog>
  )
}
