import { create } from 'zustand'

type UiState = {
  online: boolean
  brightness: number
  setOnline: (online: boolean) => void
  setBrightness: (brightness: number) => void
}

export const useUiStore = create<UiState>((set) => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  brightness: 100,
  setOnline: (online) => set({ online }),
  setBrightness: (brightness) => set({ brightness }),
}))
