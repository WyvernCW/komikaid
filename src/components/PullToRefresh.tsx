import { ArrowDown, Loader2 } from 'lucide-react'
import { type ReactNode, useCallback, useRef, useState } from 'react'

type PullToRefreshProps = {
  onRefresh: () => Promise<unknown> | void
  children: ReactNode
  disabled?: boolean
}

export function PullToRefresh({ onRefresh, children, disabled }: PullToRefreshProps) {
  const [state, setState] = useState<'idle' | 'pulling' | 'ready' | 'refreshing'>('idle')
  const startY = useRef(0)
  const pull = useRef(0)
  const pulling = useRef(false)

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || window.scrollY > 0) return
    startY.current = e.clientY
    pulling.current = false
  }, [disabled])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || startY.current === 0) return
    const dy = e.clientY - startY.current
    if (dy > 0) {
      pulling.current = true
      pull.current = dy
      setState(dy > 80 ? 'ready' : 'pulling')
      e.preventDefault()
    }
  }, [disabled])

  const handlePointerUp = useCallback(async () => {
    if (disabled || !pulling.current) {
      startY.current = 0
      return
    }
    pulling.current = false
    startY.current = 0
    if (state === 'ready') {
      setState('refreshing')
      try {
        await onRefresh()
      } finally {
        setState('idle')
      }
    } else {
      setState('idle')
    }
  }, [disabled, state, onRefresh])

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        pulling.current = false
        startY.current = 0
        setState('idle')
      }}
      style={{ touchAction: state === 'pulling' || state === 'ready' ? 'none' : undefined }}
    >
      {state !== 'idle' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: state === 'refreshing' ? '32px 0 16px' : undefined,
            height: state === 'refreshing' ? undefined : `min(${pull.current}px, 80px)`,
            color: 'var(--muted)',
            fontSize: 13,
            transition: state === 'refreshing' ? undefined : 'none',
          }}
        >
          {state === 'refreshing' ? (
            <><Loader2 size={18} className="spin" /> Memuat ulang...</>
          ) : (
            <><ArrowDown size={18} style={{ transform: `rotate(${state === 'ready' ? 180 : 0}deg)`, transition: 'transform .2s' }} /> Tarik untuk memperbarui</>
          )}
        </div>
      )}
      {children}
    </div>
  )
}
