import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import { Box, Flash } from '@primer/react'
import { useUiStore } from '../../store/uiStore'

const variantMap = {
  success: 'success',
  error: 'danger',
  info: 'default',
} as const

const IconMap = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
}

export default function Toast() {
  const { toast, clearToast } = useUiStore()
  if (!toast) return null

  const Icon = IconMap[toast.type]

  return (
    <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, minWidth: 300, maxWidth: 400 }}>
      <Flash variant={variantMap[toast.type]} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Icon size={16} />
        <Box sx={{ flex: 1, fontSize: 1 }}>{toast.message}</Box>
        <Box
          as="button"
          onClick={clearToast}
          sx={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'inherit',
            display: 'flex',
            alignItems: 'center',
            p: 0,
            opacity: 0.7,
            '&:hover': { opacity: 1 },
          }}
        >
          <X size={14} />
        </Box>
      </Flash>
    </Box>
  )
}
