import { create } from 'zustand'
import type { UpdateStatus } from '../../shared/types'

interface UpdateState {
  status: UpdateStatus
  dismissed: boolean
  setStatus: (status: UpdateStatus) => void
  dismiss: () => void
}

export const useUpdateStore = create<UpdateState>((set) => ({
  status: { state: 'not-available' },
  dismissed: false,
  setStatus: (status) => set({ status, dismissed: false }),
  dismiss: () => set({ dismissed: true })
}))
