type ClerkErrorLike = {
  errors?: Array<{
    code?: string
    message?: string
    longMessage?: string
  }>
}

export function getAuthError(error: unknown): { code: string; message: string } {
  const clerkError = error as ClerkErrorLike
  const first = clerkError.errors?.[0]
  const code = first?.code ?? ''
  const fallback = error instanceof Error ? error.message : 'Autentikasi gagal. Coba lagi.'

  if (code === 'form_identifier_not_found') {
    return { code, message: 'Email atau username tersebut tidak terdaftar.' }
  }
  if (code === 'form_identifier_exists' || code === 'form_identifier_exists__email_address') {
    return { code, message: 'Email tersebut sudah memiliki akun. Silakan masuk.' }
  }
  if (code === 'form_username_exists' || code === 'form_identifier_exists__username') {
    return { code, message: 'Username tersebut sudah digunakan.' }
  }
  if (code === 'form_code_incorrect') {
    return { code, message: 'Kode verifikasi salah atau sudah kedaluwarsa.' }
  }
  if (code === 'form_password_incorrect') {
    return { code, message: 'Password tidak benar.' }
  }
  if (
    code === 'oauth_strategy_not_allowed'
    || code === 'oauth_provider_not_enabled'
    || code === 'strategy_for_user_invalid'
  ) {
    return {
      code,
      message: 'Provider ini belum diaktifkan pada Clerk production.',
    }
  }
  if (code.includes('oauth')) {
    const detail = first?.longMessage ?? first?.message
    return {
      code,
      message: detail ? `${detail} (${code})` : `Google authentication failed (${code}).`,
    }
  }
  if (fallback.toLowerCase().includes('not authorized')) {
    return {
      code,
      message: 'Clerk menolak permintaan autentikasi. Periksa domain dan konfigurasi production.',
    }
  }

  return { code, message: first?.longMessage ?? first?.message ?? fallback }
}

export function findEmailCodeFactor(
  factors: Array<{ strategy: string; emailAddressId?: string }> | null | undefined,
) {
  return factors?.find(
    (factor): factor is { strategy: 'email_code'; emailAddressId: string } =>
      factor.strategy === 'email_code' && Boolean(factor.emailAddressId),
  )
}
