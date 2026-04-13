import { create } from 'zustand'

export interface Notification {
  id: string
  message: string
  severity: 'success' | 'error' | 'warning' | 'info'
}

interface UiState {
  sidebarOpen: boolean
  activeAccountId: string | null
  notifications: Notification[]
  setSidebarOpen: (open: boolean) => void
  setActiveAccount: (accountId: string | null) => void
  addNotification: (notification: Omit<Notification, 'id'>) => void
  dismissNotification: (id: string) => void
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  activeAccountId: null,
  notifications: [],

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setActiveAccount: (accountId) => set({ activeAccountId: accountId }),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        { ...notification, id: crypto.randomUUID() },
      ],
    })),

  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}))
