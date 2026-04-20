import { BR, entryAccent, entryGlyph } from './theme'

export function GlyphDot({
  entryType,
  subtype,
  size = 26,
}: {
  entryType: string
  subtype?: string | null
  size?: number
}) {
  const c = entryAccent(entryType, subtype)
  const glow = `${c}55`
  const s = entryGlyph(entryType, subtype)
  return (
    <div
      className="flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: 2,
        border: `1px solid ${c}`,
        color: c,
        fontFamily: BR.mono,
        fontSize: size < 22 ? 9 : 11,
        fontWeight: 600,
        background: `${c}12`,
        boxShadow: `0 0 10px ${glow}, inset 0 0 10px ${c}15`,
      }}
    >
      {s}
    </div>
  )
}
