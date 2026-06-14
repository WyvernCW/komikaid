import { create } from 'zustand'

export type AppUpdate = {
  version: string
  tag: string
  title: string
  changelog: string
  publishedAt: string
  downloadUrl: string
  fileName: string
  size: number
}

type UiState = {
  online: boolean
  brightness: number
  setOnline: (online: boolean) => void
  setBrightness: (brightness: number) => void
  availableUpdate: AppUpdate | null
  updateDialogOpen: boolean
  updateProgress: number | null
  updateMessage: string | null
  setAvailableUpdate: (update: AppUpdate | null) => void
  setUpdateDialogOpen: (open: boolean) => void
  setUpdateProgress: (progress: number | null) => void
  setUpdateMessage: (message: string | null) => void
}

export const useUiStore = create<UiState>((set) => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  brightness: 100,
  setOnline: (online) => set({ online }),
  setBrightness: (brightness) => set({ brightness }),
  availableUpdate: null,
  updateDialogOpen: false,
  updateProgress: null,
  updateMessage: null,
  setAvailableUpdate: (availableUpdate) => set({ availableUpdate }),
  setUpdateDialogOpen: (updateDialogOpen) => set({ updateDialogOpen }),
  setUpdateProgress: (updateProgress) => set({ updateProgress }),
  setUpdateMessage: (updateMessage) => set({ updateMessage }),
}))
