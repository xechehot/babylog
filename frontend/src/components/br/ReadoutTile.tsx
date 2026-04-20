import { BR } from './theme'

export function ReadoutTile({
  label,
  value,
  unit,
  note,
  accent = BR.amber,
  big,
}: {
  label: string
  value: React.ReactNode
  unit?: string
  note?: React.ReactNode
  accent?: string
  big?: boolean
}) {
  return (
    <div
      className="relative px-3.5 py-3.5"
      style={{
        border: `1px solid ${BR.line}`,
        background: 'rgba(255,179,71,0.02)',
      }}
    >
      {(['tl', 'tr', 'bl', 'br'] as const).map((k) => (
        <span
          key={k}
          className="absolute"
          style={{
            top: k.includes('t') ? -1 : undefined,
            bottom: k.includes('b') ? -1 : undefined,
            left: k.includes('l') ? -1 : undefined,
            right: k.includes('r') ? -1 : undefined,
            width: 6,
            height: 6,
            borderTop: k.includes('t') ? `1px solid ${accent}` : 'none',
            borderBottom: k.includes('b') ? `1px solid ${accent}` : 'none',
            borderLeft: k.includes('l') ? `1px solid ${accent}` : 'none',
            borderRight: k.includes('r') ? `1px solid ${accent}` : 'none',
          }}
        />
      ))}
      <div
        className="uppercase"
        style={{
          fontFamily: BR.mono,
          fontSize: 9,
          letterSpacing: 2.5,
          color: accent,
        }}
      >
        {label}
      </div>
      <div className="flex items-baseline gap-1 mt-1.5">
        <span
          style={{
            fontFamily: BR.display,
            fontSize: big ? 40 : 28,
            fontWeight: 500,
            letterSpacing: -1,
            color: BR.text,
            textShadow: `0 0 14px ${accent}66`,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
        {unit && (
          <span
            style={{
              fontFamily: BR.mono,
              fontSize: 11,
              color: BR.dim,
              letterSpacing: 1,
            }}
          >
            {unit}
          </span>
        )}
      </div>
      {note && (
        <div
          className="mt-1.5"
          style={{
            fontFamily: BR.mono,
            fontSize: 9,
            letterSpacing: 1.5,
            color: BR.dim,
          }}
        >
          {note}
        </div>
      )}
    </div>
  )
}
