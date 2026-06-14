import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { z } from 'zod'
import { api } from './api'
import type { AppUpdate } from './ui-store'

const updateSchema = z.object({
  version: z.string().regex(/^\d+(?:\.\d+){0,3}$/),
  tag: z.string().min(1).max(80),
  title: z.string().min(1).max(200),
  changelog: z.string().max(100_000),
  publishedAt: z.string().datetime(),
  downloadUrl: z.string().url(),
  fileName: z.string().min(1).max(255),
  size: z.number().int().nonnegative().max(300 * 1024 * 1024),
})

type NativeUpdaterPlugin = {
  getCurrentVersion(): Promise<{ versionName: string; versionCode: number }>
  canInstallPackages(): Promise<{ allowed: boolean }>
  openInstallPermission(): Promise<void>
  downloadAndInstall(options: {
    url: string
    fileName: string
  }): Promise<void>
  addListener(
    eventName: 'downloadProgress',
    listener: (event: { progress: number }) => void,
  ): Promise<PluginListenerHandle>
}

export const NativeUpdater = registerPlugin<NativeUpdaterPlugin>('NativeUpdater')
const deferredKey = 'komikaid.deferred-update-version'

export function compareVersions(left: string, right: string) {
  const a = left.replace(/^v/i, '').split('.').map((part) => Number(part) || 0)
  const b = right.replace(/^v/i, '').split('.').map((part) => Number(part) || 0)
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0)
    if (difference !== 0) return Math.sign(difference)
  }
  return 0
}

export async function findAvailableUpdate(): Promise<{
  update: AppUpdate | null
  deferred: boolean
}> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return { update: null, deferred: false }
  }
  const [release, current, deferred] = await Promise.all([
    api.latestAppUpdate().then((value) => updateSchema.parse(value)),
    NativeUpdater.getCurrentVersion(),
    Preferences.get({ key: deferredKey }),
  ])
  const update = compareVersions(release.version, current.versionName) > 0 ? release : null
  return { update, deferred: update?.version === deferred.value }
}

export async function deferUpdate(version: string) {
  await Preferences.set({ key: deferredKey, value: version })
}

export async function clearDeferredUpdate() {
  await Preferences.remove({ key: deferredKey })
}
