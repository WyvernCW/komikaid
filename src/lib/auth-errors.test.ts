import { describe, expect, it } from 'vitest'
import { findEmailCodeFactor, getAuthError } from './auth-errors'

describe('getAuthError', () => {
  it('explains when an account does not exist', () => {
    expect(getAuthError({
      errors: [{ code: 'form_identifier_not_found', message: 'not found' }],
    }).message).toBe('Email atau username tersebut tidak terdaftar.')
  })

  it('does not expose vague production OAuth errors', () => {
    expect(getAuthError(new Error('You are not authorized to perform this request')).message)
      .toBe('Clerk menolak permintaan autentikasi. Periksa domain dan konfigurasi production.')
  })

  it('preserves actionable OAuth error details', () => {
    expect(getAuthError({
      errors: [{
        code: 'oauth_token_invalid',
        longMessage: 'The supplied Google token could not be verified.',
      }],
    }).message).toBe(
      'The supplied Google token could not be verified. (oauth_token_invalid)',
    )
  })
})

describe('findEmailCodeFactor', () => {
  it('selects the verified email factor', () => {
    expect(findEmailCodeFactor([
      { strategy: 'password' },
      { strategy: 'email_code', emailAddressId: 'idn_123' },
    ])).toEqual({ strategy: 'email_code', emailAddressId: 'idn_123' })
  })
})
