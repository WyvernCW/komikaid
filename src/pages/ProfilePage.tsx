import { Show, UserButton, useAuth, useUser } from '@clerk/react'
import { useSignIn, useSignUp } from '@clerk/react/legacy'
import { Capacitor } from '@capacitor/core'
<<<<<<< HEAD
import { Bell, Cloud, Mail, Moon, ShieldCheck, UserPlus, X } from 'lucide-react'
import { type FormEvent, useState } from 'react'
=======
import { Bell, Cloud, Mail, Moon, ShieldCheck, UserPlus, X, FileText } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import ChangelogViewer from '../components/ChangelogViewer'
>>>>>>> 3e83d39 (some changes on mobile.)
import { ProfileSkeleton } from '../components/States'
import { reconcileAccount } from '../lib/account-sync'
import { findEmailCodeFactor, getAuthError } from '../lib/auth-errors'
import { getNativeGoogleIdToken } from '../lib/native-google-auth'
import { notifications } from '../lib/notifications'

type AccountMode = 'sign-in' | 'sign-up'
type EmailStep = 'form' | 'code'
type SignInMethod = 'code' | 'password'
type SocialProvider = 'oauth_google' | 'oauth_github' | 'oauth_facebook'

function ProfileContent() {
  const { user } = useUser()
  const { getToken, isLoaded } = useAuth()
  const { signIn, setActive: setActiveSignIn, isLoaded: signInLoaded } = useSignIn()
  const { signUp, setActive: setActiveSignUp, isLoaded: signUpLoaded } = useSignUp()
  const [status, setStatus] = useState('')
  const [notificationStatus, setNotificationStatus] = useState('')
  const [accountOpen, setAccountOpen] = useState(false)
<<<<<<< HEAD
=======
  const [changelogOpen, setChangelogOpen] = useState(false)
>>>>>>> 3e83d39 (some changes on mobile.)
  const [mode, setMode] = useState<AccountMode>('sign-up')
  const [emailStep, setEmailStep] = useState<EmailStep>('form')
  const [signInMethod, setSignInMethod] = useState<SignInMethod>('code')
  const [email, setEmail] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const native = Capacitor.isNativePlatform()

  const finishSession = async (
    createdSessionId: string | null,
    setActive: (params: { session: string }) => Promise<unknown>,
  ) => {
    if (!createdSessionId) throw new Error('Clerk tidak membuat sesi baru.')
    await setActive({ session: createdSessionId })
    setAccountOpen(false)
  }

  const run = async (action: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    setStatus('')
    try {
      await action()
    } catch (error) {
      const authError = getAuthError(error)
      console.error('Authentication failed', {
        code: authError.code || 'unknown',
        message: authError.message,
      })
      setStatus(authError.message)
    } finally {
      setBusy(false)
    }
  }

  const signInWithGoogle = () => run(async () => {
    if (native) {
      const idToken = await getNativeGoogleIdToken()
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/google/native`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })
      const body = await response.json() as {
        ticket?: string
        error?: { message?: string }
      }
      if (!response.ok || !body.ticket) {
        throw new Error(body.error?.message || 'Native Google authentication failed.')
      }
      if (!signInLoaded) throw new Error('Clerk belum siap. Coba lagi.')
      const result = await signIn.create({ strategy: 'ticket', ticket: body.ticket })
      if (result.status !== 'complete') throw new Error('Login membutuhkan langkah tambahan.')
      await finishSession(result.createdSessionId, setActiveSignIn)
      return
    }
    const authResource = mode === 'sign-up' ? signUp : signIn
    const authLoaded = mode === 'sign-up' ? signUpLoaded : signInLoaded
    if (!authLoaded || !authResource) return
    await authResource.authenticateWithRedirect({
      strategy: 'oauth_google',
      redirectUrl: '/sso-callback',
      redirectUrlComplete: '/profile',
    })
  })

  const signInWithSocial = (provider: Exclude<SocialProvider, 'oauth_google'>) => run(async () => {
    const authResource = mode === 'sign-up' ? signUp : signIn
    const authLoaded = mode === 'sign-up' ? signUpLoaded : signInLoaded
    if (!authLoaded || !authResource) return
    await authResource.authenticateWithRedirect({
      strategy: provider,
      redirectUrl: '/sso-callback',
      redirectUrlComplete: '/profile',
    })
  })

  const sendSignInCode = (event: FormEvent) => {
    event.preventDefault()
    void run(async () => {
      if (!signInLoaded) return
      const normalizedEmail = email.trim().toLowerCase()
      if (!normalizedEmail || !normalizedEmail.includes('@')) {
        throw new Error('Masukkan alamat email yang valid.')
      }
      const result = await signIn.create({ identifier: normalizedEmail })
      const factor = findEmailCodeFactor(result.supportedFirstFactors)
      if (!factor) throw new Error('Akun ini tidak mendukung kode email.')
      await signIn.prepareFirstFactor({
        strategy: 'email_code',
        emailAddressId: factor.emailAddressId,
      })
      setEmailStep('code')
      setStatus(`Kode sudah dikirim ke ${normalizedEmail}.`)
    })
  }

  const verifySignInCode = (event: FormEvent) => {
    event.preventDefault()
    void run(async () => {
      if (!signInLoaded) return
      const result = await signIn.attemptFirstFactor({
        strategy: 'email_code',
        code: code.trim(),
      })
      if (result.status !== 'complete') throw new Error('Verifikasi membutuhkan langkah tambahan.')
      await finishSession(result.createdSessionId, setActiveSignIn)
    })
  }

  const signInWithPassword = (event: FormEvent) => {
    event.preventDefault()
    void run(async () => {
      if (!signInLoaded) return
      const result = await signIn.create({
        identifier: identifier.trim(),
        password,
      })
      if (result.status !== 'complete') throw new Error('Login membutuhkan langkah tambahan.')
      await finishSession(result.createdSessionId, setActiveSignIn)
    })
  }

  const createAccount = (event: FormEvent) => {
    event.preventDefault()
    void run(async () => {
      if (!signUpLoaded) return
      const normalizedEmail = email.trim().toLowerCase()
      if (!normalizedEmail.includes('@')) throw new Error('Masukkan alamat email yang valid.')
      if (username.trim().length < 4) throw new Error('Username minimal 4 karakter.')
      if (password.length < 8) throw new Error('Password minimal 8 karakter.')
      await signUp.create({
        emailAddress: normalizedEmail,
        username: username.trim(),
        password,
      })
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
      setEmailStep('code')
      setStatus(`Kode verifikasi dikirim ke ${normalizedEmail}.`)
    })
  }

  const verifyNewAccount = (event: FormEvent) => {
    event.preventDefault()
    void run(async () => {
      if (!signUpLoaded) return
      const result = await signUp.attemptEmailAddressVerification({ code: code.trim() })
      if (result.status !== 'complete') throw new Error('Akun masih membutuhkan informasi tambahan.')
      await finishSession(result.createdSessionId, setActiveSignUp)
    })
  }

  const sync = async () => {
    const token = await getToken()
    if (!token) return
    setStatus('Menyinkronkan...')
    try {
      await reconcileAccount(token)
      setStatus('Sinkronisasi selesai')
    } catch {
      setStatus('Sinkronisasi belum tersedia')
    }
  }

  const switchMode = (next: AccountMode) => {
    setMode(next)
    setEmailStep('form')
    setCode('')
    setStatus('')
  }

  const closeAccount = () => {
    setAccountOpen(false)
    setStatus('')
    setEmailStep('form')
    setCode('')
  }

  if (!isLoaded) return <ProfileSkeleton />

  return (
    <section className="section page-section profile-page">
      <span className="eyebrow">Akun dan preferensi</span>
      <h1 className="page-title">Profil</h1>
      <Show when="signed-out">
        <div className="auth-panel">
          <div>
            <ShieldCheck size={36} />
            <h2>Simpan progres lintas perangkat</h2>
            <p>Buat akun untuk menyinkronkan favorit, progres baca, dan notifikasi rilis.</p>
          </div>
          <button className="primary-action make-account-button" onClick={() => setAccountOpen(true)}>
            <UserPlus size={19} />
            Make an account
          </button>
        </div>
        {accountOpen && (
          <div className="account-sheet-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.currentTarget === event.target) closeAccount()
          }}>
            <div className="account-sheet" role="dialog" aria-modal="true" aria-labelledby="account-title">
              <header>
                <div>
                  <span className="eyebrow">KomikaID account</span>
                  <h2 id="account-title">{mode === 'sign-up' ? 'Make an account' : 'Welcome back'}</h2>
                </div>
                <button aria-label="Tutup" onClick={closeAccount}><X /></button>
              </header>

              <div className="account-tabs" role="tablist" aria-label="Jenis autentikasi">
                <button className={mode === 'sign-up' ? 'is-active' : ''} onClick={() => switchMode('sign-up')}>Daftar</button>
                <button className={mode === 'sign-in' ? 'is-active' : ''} onClick={() => switchMode('sign-in')}>Masuk</button>
              </div>

              <div className="social-auth-grid">
                <button disabled={busy || (!native && (mode === 'sign-up' ? !signUpLoaded : !signInLoaded))} onClick={signInWithGoogle}><b>G</b><span>Google</span></button>
                <button disabled={busy || (mode === 'sign-up' ? !signUpLoaded : !signInLoaded)} onClick={() => void signInWithSocial('oauth_github')}><b>GH</b><span>GitHub</span></button>
                <button disabled={busy || (mode === 'sign-up' ? !signUpLoaded : !signInLoaded)} onClick={() => void signInWithSocial('oauth_facebook')}><b>f</b><span>Facebook</span></button>
              </div>

              <div className="account-divider"><span>atau gunakan akun KomikaID</span></div>

              {mode === 'sign-in' && emailStep === 'form' && (
                <>
                  <div className="sign-in-methods">
                    <button className={signInMethod === 'code' ? 'is-active' : ''} onClick={() => setSignInMethod('code')}>Kode email</button>
                    <button className={signInMethod === 'password' ? 'is-active' : ''} onClick={() => setSignInMethod('password')}>Password</button>
                  </div>
                  {signInMethod === 'code' ? (
                    <form className="account-form" onSubmit={sendSignInCode}>
                      <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
                      <small>Kami memeriksa apakah akun ada sebelum mengirim kode.</small>
                      <button className="primary-action" disabled={busy || !signInLoaded}><Mail size={18} />Kirim kode</button>
                    </form>
                  ) : (
                    <form className="account-form" onSubmit={signInWithPassword}>
                      <label>Email atau username<input autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} required /></label>
                      <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
                      <button className="primary-action" disabled={busy || !signInLoaded}>Masuk</button>
                    </form>
                  )}
                </>
              )}

              {mode === 'sign-up' && emailStep === 'form' && (
                <form className="account-form" onSubmit={createAccount}>
                  <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
                  <label>Username<input autoComplete="username" minLength={4} value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
                  <label>Password<input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
                  <small>Email harus diverifikasi sebelum akun dapat digunakan.</small>
                  <button className="primary-action" disabled={busy || !signUpLoaded}>Buat akun</button>
                </form>
              )}

              {emailStep === 'code' && (
                <form className="account-form verification-form" onSubmit={mode === 'sign-up' ? verifyNewAccount : verifySignInCode}>
                  <label>Kode 6 digit<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} required /></label>
                  <button className="primary-action" disabled={busy || code.length < 6}>Verifikasi</button>
                  <button type="button" className="text-action" onClick={() => {
                    setEmailStep('form')
                    setCode('')
                    setStatus('')
                  }}>Gunakan email lain</button>
                </form>
              )}

              {status && <p className="auth-status" role="status">{status}</p>}
            </div>
          </div>
        )}
      </Show>
      <Show when="signed-in">
        <div className="profile-card">
          <UserButton />
          <div><h2>{user?.fullName ?? user?.username ?? 'Pembaca KomikaID'}</h2><p>{user?.primaryEmailAddress?.emailAddress}</p></div>
        </div>
        <div className="settings-list">
          <button onClick={sync}><Cloud /><span><strong>Sinkronisasi akun</strong><small>{status || 'Otomatis saat login, online, dan aplikasi dibuka'}</small></span></button>
          <button onClick={async () => {
            const result = await notifications.requestPermission()
            setNotificationStatus(result.message)
          }}><Bell /><span><strong>Notifikasi rilis</strong><small>{notificationStatus || 'Izinkan pengingat chapter baru'}</small></span></button>
          <div><Moon /><span><strong>Mode gelap</strong><small>Aktif secara default</small></span></div>
<<<<<<< HEAD
        </div>
=======
          <button onClick={() => setChangelogOpen(true)}><FileText /><span><strong>Catatan rilis</strong><small>Riwayat pembaruan KomikaID</small></span></button>
        </div>
        {changelogOpen && <ChangelogViewer onClose={() => setChangelogOpen(false)} />}
>>>>>>> 3e83d39 (some changes on mobile.)
      </Show>
    </section>
  )
}

export function ProfilePage() {
  return <ProfileContent />
}
