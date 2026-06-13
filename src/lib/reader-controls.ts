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

export function isReaderDoublePress(previous: TapPoint | null, current: TapPoint) {
  if (!previous || current.time - previous.time >= 900) return false
  return Math.hypot(current.x - previous.x, current.y - previous.y) < 120
}
