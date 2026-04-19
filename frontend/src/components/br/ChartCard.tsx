import { BR } from './theme'

export function ChartCard({
  kicker,
  title,
  subtitle,
  toolbar,
  children,
  footer,
  height = 220,
  accent = BR.amber,
}: {
  kicker?: string
  title?: React.ReactNode
  subtitle?: React.ReactNode
  toolbar?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  height?: number
  accent?: string
}) {
  return (
    <div
      className="relative"
      style={{
        border: `1px solid ${BR.line}`,
        background: 'linear-gradient(180deg, rgba(255,179,71,0.025), rgba(6,8,10,0.4))',
        padding: 14,
        marginBottom: 14,
      }}
    >
      {/* corner ticks */}
      {(['tl', 'tr', 'bl', 'br'] as const).map((k) => (
        <span
          key={k}
          className="absolute"
          style={{
            top: k.includes('t') ? -1 : undefined,
            bottom: k.includes('b') ? -1 : undefined,
            left: k.includes('l') ? -1 : undefined,
            right: k.includes('r') ? -1 : undefined,
            width: 7,
            height: 7,
            borderTop: k.includes('t') ? `1px solid ${accent}` : 'none',
            borderBottom: k.includes('b') ? `1px solid ${accent}` : 'none',
            borderLeft: k.includes('l') ? `1px solid ${accent}` : 'none',
            borderRight: k.includes('r') ? `1px solid ${accent}` : 'none',
          }}
        />
      ))}
      {(kicker || title || subtitle || toolbar) && (
        <div className="flex items-end justify-between mb-2 gap-2">
          <div className="min-w-0">
            {kicker && (
              <div
                className="uppercase"
                style={{
                  fontFamily: BR.mono,
                  fontSize: 8.5,
                  letterSpacing: 2.5,
                  color: accent,
                  textShadow: `0 0 8px ${accent}55`,
                }}
              >
                {kicker}
              </div>
            )}
            {title && (
              <div
                className="mt-0.5"
                style={{
                  fontFamily: BR.display,
                  fontSize: 16,
                  fontWeight: 500,
                  letterSpacing: -0.3,
                  color: BR.text,
                }}
              >
                {title}
              </div>
            )}
            {subtitle && (
              <div
                className="mt-0.5"
                style={{
                  fontFamily: BR.serif,
                  fontStyle: 'italic',
                  fontSize: 12,
                  color: BR.dim,
                }}
              >
                {subtitle}
              </div>
            )}
          </div>
          {toolbar && <div className="flex gap-1.5 shrink-0">{toolbar}</div>}
        </div>
      )}
      <div className="relative" style={{ height }}>
        {children}
      </div>
      {footer}
    </div>
  )
}
