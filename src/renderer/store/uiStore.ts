import { create } from 'zustand'

type ModalType = 'add-bus' | 'edit-bus' | 'add-route' | 'edit-route' | 'add-stop' | 'edit-stop' | 'add-shift' | 'edit-shift' | null

interface UiState {
  modal: ModalType
  modalData: unknown
  toast: { message: string; type: 'success' | 'error' | 'info' } | null
  sidebarCollapsed: boolean

  openModal: (type: ModalType, data?: unknown) => void
  closeModal: () => void
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
  clearToast: () => void
  toggleSidebar: () => void
}

export const useUiStore = create<UiState>((set) => ({
  modal: null,
  modalData: null,
  toast: null,
  sidebarCollapsed: false,

  openModal: (type, data = null) => set({ modal: type, modalData: data }),
  closeModal: () => set({ modal: null, modalData: null }),

  showToast: (message, type = 'success') => {
    set({ toast: { message, type } })
    setTimeout(() => set({ toast: null }), 3500)
  },

  clearToast: () => set({ toast: null }),

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
}))
