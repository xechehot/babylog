import { useEffect } from 'react'
import { BR } from './br/theme'

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div
        className="absolute inset-0"
        onClick={onClose}
        style={{ background: 'rgba(6,8,10,0.72)', backdropFilter: 'blur(2px)' }}
      />
      <div
        className="relative w-full max-h-[85vh] flex flex-col pb-[env(safe-area-inset-bottom)]"
        style={{
          background: BR.ink,
          borderTop: `1px solid ${BR.amber}`,
          boxShadow: `0 -20px 60px rgba(255,179,71,0.1), 0 -1px 0 ${BR.amberGlow}`,
        }}
      >
        {/* Top corner brackets */}
        {(['tl', 'tr'] as const).map((k) => (
          <span
            key={k}
            className="absolute"
            style={{
              top: 8,
              left: k === 'tl' ? 10 : undefined,
              right: k === 'tr' ? 10 : undefined,
              width: 12,
              height: 12,
              borderTop: `2px solid ${BR.amber}`,
              borderLeft: k === 'tl' ? `2px solid ${BR.amber}` : 'none',
              borderRight: k === 'tr' ? `2px solid ${BR.amber}` : 'none',
            }}
          />
        ))}
        <div
          className="flex items-center justify-between"
          style={{
            padding: '16px 20px 12px',
            borderBottom: `1px solid ${BR.line}`,
          }}
        >
          <h2
            className="uppercase"
            style={{
              fontFamily: BR.mono,
              fontSize: 11,
              letterSpacing: 2.5,
              color: BR.amber,
              textShadow: `0 0 8px ${BR.amberGlow}`,
            }}
          >
            [ {title} ]
          </h2>
          <button
            onClick={onClose}
            className="leading-none"
            style={{
              fontFamily: BR.mono,
              fontSize: 22,
              color: BR.amber,
              padding: '0 8px',
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}
