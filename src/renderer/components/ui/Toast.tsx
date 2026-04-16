import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import { Flash } from '@primer/react'
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
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, minWidth: 300, maxWidth: 400 }}>
      <Flash variant={variantMap[toast.type]} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Icon size={16} />
        <span style={{ flex: 1, fontSize: 14 }}>{toast.message}</span>
        <button
          onClick={clearToast}
          className="hov-opacity-full"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', alignItems: 'center', padding: 0 }}
        >
          <X size={14} />
        </button>
      </Flash>
    </div>
  )
}
