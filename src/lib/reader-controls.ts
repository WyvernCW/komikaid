export type ReaderControlsState = {
  chapterId: string
  visible: boolean
}

export type TapPoint = {
  time: number
  x: number
  y: number
}

export function toggleReaderControls(
  current: ReaderControlsState,
  chapterId: string,
): ReaderControlsState {
  return {
    chapterId,
    visible: current.chapterId === chapterId ? !current.visible : true,
  }
}

export function areReaderControlsVisible(
  controls: ReaderControlsState,
  chapterId: string,
) {
  return controls.chapterId === chapterId && controls.visible
}

<<<<<<< HEAD
export function isReaderDoublePress(previous: TapPoint | null, current: TapPoint) {
  if (!previous || current.time - previous.time >= 900) return false
  return Math.hypot(current.x - previous.x, current.y - previous.y) < 120
=======
export function isReaderHorizontalSwipe(
  start: { x: number; y: number },
  end: { x: number; y: number },
  threshold = 60,
) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const travel = Math.hypot(dx, dy)
  if (travel < threshold) return null
  if (Math.abs(dx) > Math.abs(dy) * 1.5) return dx < 0 ? 'next' : 'prev'
  return null
>>>>>>> 3e83d39 (some changes on mobile.)
}
