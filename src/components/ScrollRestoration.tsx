import { useLayoutEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

const positions = new Map<string, number>()

export function ScrollRestoration() {
  const location = useLocation()
  const navigationType = useNavigationType()

  useLayoutEffect(() => {
    const position = navigationType === 'POP' ? positions.get(location.key) ?? 0 : 0
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: position, left: 0, behavior: 'instant' }))
    return () => {
      window.cancelAnimationFrame(frame)
      positions.set(location.key, window.scrollY)
    }
  }, [location.key, navigationType])

  return null
}
