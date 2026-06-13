export const LIBRARY_CHANGED_EVENT = 'komikaid:library-changed'
export const LIBRARY_UPDATED_EVENT = 'komikaid:library-updated'

export function emitLibraryChanged() {
  window.dispatchEvent(new Event(LIBRARY_CHANGED_EVENT))
}

export function emitLibraryUpdated() {
  window.dispatchEvent(new Event(LIBRARY_UPDATED_EVENT))
}
