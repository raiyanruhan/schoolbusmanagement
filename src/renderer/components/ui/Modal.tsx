import { type ReactNode } from 'react'
import { Dialog, Box, Heading } from '@primer/react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const widthMap = { sm: 480, md: 600, lg: 768 }

export default function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  if (!open) return null

  return (
    <Dialog
      title={title}
      onClose={onClose}
      sx={{ width: widthMap[size] }}
      renderHeader={() => (
        <Dialog.Header>
          <Heading as="h2" sx={{ fontSize: 2 }}>{title}</Heading>
        </Dialog.Header>
      )}
    >
      <Box sx={{ p: 4 }}>{children}</Box>
    </Dialog>
  )
}
