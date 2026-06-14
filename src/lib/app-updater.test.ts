import { describe, expect, it } from 'vitest'
import { compareVersions } from './app-updater'

describe('compareVersions', () => {
  it('compares semantic release versions', () => {
    expect(compareVersions('1.1.0', '1.0.0')).toBe(1)
    expect(compareVersions('v2.0', '2.0.0')).toBe(0)
    expect(compareVersions('1.0.9', '1.1.0')).toBe(-1)
  })
})
