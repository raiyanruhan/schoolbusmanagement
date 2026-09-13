import { useState } from 'react'
import { Button, Text } from '@primer/react'
import Modal from './Modal'
import { useUpdateStore } from '../../store/updateStore'

// Mandatory update, already downloaded — blocks the app until installed.
// No close button, no escape/backdrop dismissal (Modal's onClose is a no-op here).
export default function MandatoryUpdateModal() {
  const { status } = useUpdateStore()
  const [installing, setInstalling] = useState(false)

  if (status.state !== 'downloaded' || !status.mandatory) return null

  const installAndRestart = (): void => {
    setInstalling(true)
    void window.api.update.installNow()
  }

  return (
    <Modal open onClose={() => {}} title="Update Required" size="sm">
      <Text as="p" sx={{ fontSize: 1, mb: 3 }}>
        Version {status.version} includes a required update. The app will restart to install it.
      </Text>
      {status.notes && (
        <Text as="p" sx={{ fontSize: 0, color: 'fg.muted', mb: 3 }}>
          {status.notes}
        </Text>
      )}
      <Button variant="primary" block onClick={installAndRestart} disabled={installing}>
        {installing ? 'Restarting…' : 'Restart & Install Now'}
      </Button>
    </Modal>
  )
}
