import { describe, expect, it } from 'vitest'
import {
  areReaderControlsVisible,
<<<<<<< HEAD
  isReaderDoublePress,
=======
  isReaderHorizontalSwipe,
>>>>>>> 3e83d39 (some changes on mobile.)
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

<<<<<<< HEAD
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
=======
  it('detects horizontal swipes and ignores short or vertical movement', () => {
    expect(isReaderHorizontalSwipe({ x: 200, y: 200 }, { x: 100, y: 205 })).toBe('next')
    expect(isReaderHorizontalSwipe({ x: 100, y: 200 }, { x: 200, y: 205 })).toBe('prev')
    expect(isReaderHorizontalSwipe({ x: 100, y: 200 }, { x: 110, y: 200 })).toBeNull()
    expect(isReaderHorizontalSwipe({ x: 100, y: 200 }, { x: 200, y: 300 })).toBeNull()
>>>>>>> 3e83d39 (some changes on mobile.)
  })
})
