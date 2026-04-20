import { BR } from './theme'

export function Pill({
  active,
  onClick,
  accent = BR.amber,
  children,
}: {
  active: boolean
  onClick: () => void
  accent?: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      className="uppercase"
      style={{
        fontFamily: BR.mono,
        fontSize: 9,
        letterSpacing: 1.8,
        padding: '4px 8px',
        background: active ? `${accent}18` : 'transparent',
        color: active ? accent : BR.dim,
        border: `1px solid ${active ? accent : BR.line}`,
        textShadow: active ? `0 0 6px ${accent}88` : 'none',
      }}
    >
      {children}
    </button>
  )
}
