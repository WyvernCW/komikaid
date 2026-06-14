import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Download, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  clearDeferredUpdate,
  deferUpdate,
  findAvailableUpdate,
  NativeUpdater,
} from '../lib/app-updater'
import { useUiStore } from '../lib/ui-store'

let lastUpdateCheck = 0

export default function UpdateServices() {
  const update = useUiStore((state) => state.availableUpdate)
  const open = useUiStore((state) => state.updateDialogOpen)
  const progress = useUiStore((state) => state.updateProgress)
  const message = useUiStore((state) => state.updateMessage)
  const setUpdate = useUiStore((state) => state.setAvailableUpdate)
  const setOpen = useUiStore((state) => state.setUpdateDialogOpen)
  const setProgress = useUiStore((state) => state.setUpdateProgress)
  const setMessage = useUiStore((state) => state.setUpdateMessage)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let active = true
    const check = async (force = false) => {
      if (!force && Date.now() - lastUpdateCheck < 6 * 60 * 60_000) return
      lastUpdateCheck = Date.now()
      try {
        const result = await findAvailableUpdate()
        if (!active || !result.update) return
        setUpdate(result.update)
        if (!result.deferred) setOpen(true)
      } catch {
        // Update checks must never block normal app startup.
      }
    }
    const timer = window.setTimeout(() => void check(true), 1_500)
    const resume = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void check()
    })
    const listener = NativeUpdater.addListener('downloadProgress', ({ progress: next }) => {
      if (active) setProgress(next)
    })
    return () => {
      active = false
      window.clearTimeout(timer)
      void resume.then((handle) => handle.remove())
      void listener.then((handle) => handle.remove())
    }
  }, [setOpen, setProgress, setUpdate])

  if (!update || !open) return null

  const later = async () => {
    await deferUpdate(update.version)
    setOpen(false)
  }

  const install = async () => {
    setInstalling(true)
    setMessage(null)
    setProgress(0)
    try {
      const permission = await NativeUpdater.canInstallPackages()
      if (!permission.allowed) {
        await NativeUpdater.openInstallPermission()
        setMessage('Izinkan pemasangan aplikasi, lalu kembali dan tekan Perbarui sekarang.')
        return
      }
      await clearDeferredUpdate()
      await NativeUpdater.downloadAndInstall({
        url: update.downloadUrl,
        fileName: update.fileName,
      })
    } catch {
      setMessage('Pembaruan gagal diunduh. Periksa koneksi lalu coba lagi.')
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div className="update-dialog-backdrop" role="presentation">
      <section className="update-dialog" role="dialog" aria-modal="true" aria-labelledby="update-title">
        <header>
          <div>
            <span className="eyebrow">PEMBARUAN TERSEDIA</span>
            <h2 id="update-title">{update.title}</h2>
            <p>Versi {update.version} · {(update.size / 1024 / 1024).toFixed(1)} MB</p>
          </div>
          <button type="button" className="icon-button" onClick={later} aria-label="Ingatkan nanti">
            <X size={20} />
          </button>
        </header>
        <div className="update-changelog">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{update.changelog}</ReactMarkdown>
        </div>
        {progress !== null && installing && (
          <div className="update-progress" aria-live="polite">
            <span style={{ width: `${progress}%` }} />
            <small>Mengunduh {progress}%</small>
          </div>
        )}
        {message && <p className="update-message" role="status">{message}</p>}
        <footer>
          <button type="button" className="secondary-button" onClick={later} disabled={installing}>Nanti</button>
          <button type="button" className="primary-button" onClick={install} disabled={installing}>
            <Download size={18} /> {installing ? 'Mengunduh...' : 'Perbarui sekarang'}
          </button>
        </footer>
      </section>
    </div>
  )
}
