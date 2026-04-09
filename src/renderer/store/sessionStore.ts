import { create } from 'zustand'
import type { Session, DashboardStats } from '../../shared/types'

interface SessionState {
  session: Session | null
  stats: DashboardStats | null
  loading: boolean
  error: string | null

  loadSession: () => Promise<void>
  loadStats: () => Promise<void>
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  stats: null,
  loading: false,
  error: null,

  loadSession: async () => {
    set({ loading: true, error: null })
    const result = await window.api.session.getOrCreateToday()
    if (result.success) {
      set({ session: result.data, loading: false })
    } else {
      set({ error: result.error, loading: false })
    }
  },

  loadStats: async () => {
    const result = await window.api.session.getDashboardStats()
    if (result.success) {
      set({ stats: result.data, session: result.data.session })
    }
  }
}))
