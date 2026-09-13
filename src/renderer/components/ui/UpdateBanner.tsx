import { useState } from 'react'
import { Download, X } from 'lucide-react'
import { Flash, Button } from '@primer/react'
import { useUpdateStore } from '../../store/updateStore'

// Optional update, already downloaded and ready — non-blocking, dismissible.
// Mandatory updates use MandatoryUpdateModal instead.
export default function UpdateBanner() {
  const { status, dismissed, dismiss } = useUpdateStore()
  const [installing, setInstalling] = useState(false)

  if (status.state !== 'downloaded' || status.mandatory || dismissed) return null

  const later = (): void => {
    void window.api.update.skip(status.version)
    dismiss()
  }

  const installAndRestart = (): void => {
    setInstalling(true)
    void window.api.update.installNow()
  }

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9998, minWidth: 320, maxWidth: 420 }}>
      <Flash variant="success" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Download size={16} />
        <span style={{ flex: 1, fontSize: 14 }}>
          Update ready — v{status.version}. Restart to apply.
        </span>
        <Button size="small" variant="primary" onClick={installAndRestart} disabled={installing}>
          {installing ? 'Restarting…' : 'Restart Now'}
        </Button>
        <button
          onClick={later}
          disabled={installing}
          className="hov-opacity-full"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', alignItems: 'center', padding: 0 }}
          aria-label="Remind me later"
        >
          <X size={14} />
        </button>
      </Flash>
    </div>
  )
}
