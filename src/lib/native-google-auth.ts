import { Capacitor, registerPlugin } from '@capacitor/core'

type NativeGoogleAuthResult = {
  idToken: string
}

type NativeGoogleAuthPlugin = {
  signIn(options: { serverClientId: string }): Promise<NativeGoogleAuthResult>
}

const NativeGoogleAuth = registerPlugin<NativeGoogleAuthPlugin>('NativeGoogleAuth')

export async function getNativeGoogleIdToken(): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Native Google sign-in is only available in the mobile app.')
  }
  const serverClientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID
  if (!serverClientId) throw new Error('Google sign-in is not configured.')
  const result = await NativeGoogleAuth.signIn({ serverClientId })
  if (!result.idToken) throw new Error('Google did not return an identity token.')
  return result.idToken
}
