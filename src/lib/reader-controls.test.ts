import { describe, expect, it } from 'vitest'
import {
  areReaderControlsVisible,
  isReaderDoublePress,
  toggleReaderControls,
} from './reader-controls.js'

describe('reader controls', () => {
  it('shows on the first toggle and hides on the second toggle', () => {
    const visible = toggleReaderControls({ chapterId: 'chapter-a', visible: false }, 'chapter-a')
    expect(areReaderControlsVisible(visible, 'chapter-a')).toBe(true)

    const hidden = toggleReaderControls(visible, 'chapter-a')
    expect(areReaderControlsVisible(hidden, 'chapter-a')).toBe(false)
  })

  it('starts hidden when navigating to another chapter', () => {
    const current = { chapterId: 'chapter-a', visible: true }
    expect(areReaderControlsVisible(current, 'chapter-b')).toBe(false)
  })

  it('recognizes forgiving double presses without treating distant input as one', () => {
    expect(isReaderDoublePress(
      { time: 1_000, x: 120, y: 240 },
      { time: 1_820, x: 190, y: 300 },
    )).toBe(true)
    expect(isReaderDoublePress(
      { time: 1_000, x: 120, y: 240 },
      { time: 1_950, x: 120, y: 240 },
    )).toBe(false)
    expect(isReaderDoublePress(
      { time: 1_000, x: 120, y: 240 },
      { time: 1_200, x: 220, y: 340 },
    )).toBe(false)
  })
})
