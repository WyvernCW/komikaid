import { Capacitor } from '@capacitor/core'
import * as OneSignalModule from 'onesignal-cordova-plugin'

type OneSignalRuntime = {
  initialize(appId: string): void
  login(userId: string): void
  logout(): void
  Notifications: {
    requestPermission(fallbackToSettings?: boolean): Promise<boolean>
    addEventListener(
      event: 'click',
      listener: (event: {
        notification: { additionalData?: object }
      }) => void,
    ): void
  }
  User: {
    addTag(key: string, value: string): void
    removeTag(key: string): void
  }
}

export type NotificationPermissionResult = {
  supported: boolean
  granted: boolean
  message: string
}

function getOneSignal(): OneSignalRuntime | null {
  const module = OneSignalModule as unknown as {
    default?: OneSignalRuntime | { default?: OneSignalRuntime }
  }
  const direct = module.default
  const nested =
    direct && 'default' in direct
      ? (direct as { default?: OneSignalRuntime }).default
      : undefined
  const candidate =
    direct && typeof (direct as OneSignalRuntime).initialize === 'function'
      ? (direct as OneSignalRuntime)
      : nested ?? window.plugins?.OneSignal

  return candidate && typeof candidate.initialize === 'function' ? candidate : null
}

class NotificationService {
  private initialized = false
  private runtime: OneSignalRuntime | null = null

  async initialize(userId?: string | null) {
    const appId = import.meta.env.VITE_ONESIGNAL_APP_ID
    if (!Capacitor.isNativePlatform() || !appId) return
    if (this.initialized) {
      if (userId !== undefined) this.identify(userId)
      return
    }

    try {
      const runtime = getOneSignal()
      if (!runtime) {
        console.warn('OneSignal native bridge is unavailable; notifications are disabled.')
        return
      }

      runtime.initialize(appId)
      runtime.Notifications.addEventListener('click', (event) => {
        const data = event.notification.additionalData as Record<string, unknown> | undefined
        const comicId = data?.comicId
        const chapterId = data?.chapterId
        if (typeof chapterId === 'string') {
          const comicQuery = typeof comicId === 'string' ? `?comic=${encodeURIComponent(comicId)}` : ''
          window.location.assign(`/reader/${encodeURIComponent(chapterId)}${comicQuery}`)
        } else if (typeof comicId === 'string') {
          window.location.assign(`/comic/${encodeURIComponent(comicId)}`)
        }
      })
      if (userId) runtime.login(userId)
      this.runtime = runtime
      this.initialized = true
    } catch (error) {
      console.error('OneSignal initialization failed; continuing without notifications.', error)
    }
  }

  async requestPermission(): Promise<NotificationPermissionResult> {
    if (!Capacitor.isNativePlatform()) {
      return {
        supported: false,
        granted: false,
        message: 'Push rilis tersedia di aplikasi Android. Browser hanya dapat menguji tampilan dan pengaturan.',
      }
    }
    await this.initialize()
    if (!this.runtime) {
      return {
        supported: false,
        granted: false,
        message: 'Layanan notifikasi Android belum tersedia. Periksa konfigurasi OneSignal.',
      }
    }

    try {
      const granted = await this.runtime.Notifications.requestPermission(false)
      return {
        supported: true,
        granted,
        message: granted ? 'Notifikasi rilis diaktifkan.' : 'Izin notifikasi belum diberikan.',
      }
    } catch (error) {
      console.error('Unable to request notification permission.', error)
      return {
        supported: true,
        granted: false,
        message: 'Izin notifikasi gagal diminta. Coba lagi dari pengaturan aplikasi.',
      }
    }
  }

  identify(userId: string | null) {
    if (!this.initialized || !this.runtime) return

    try {
      if (userId) this.runtime.login(userId)
      else this.runtime.logout()
    } catch (error) {
      console.error('Unable to update the OneSignal user.', error)
    }
  }

  followComic(comicId: string, enabled: boolean) {
    if (!this.initialized || !this.runtime) return

    try {
      if (enabled) this.runtime.User.addTag(`comic_${comicId}`, 'true')
      else this.runtime.User.removeTag(`comic_${comicId}`)
    } catch (error) {
      console.error('Unable to update the comic notification preference.', error)
    }
  }
}

export const notifications = new NotificationService()
