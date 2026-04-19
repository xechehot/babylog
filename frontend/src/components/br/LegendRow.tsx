import { BR } from './theme'

export interface LegendItem {
  color: string
  label: string
  line?: boolean
}

export function LegendRow({ items }: { items: LegendItem[] }) {
  return (
    <div
      className="flex flex-wrap"
      style={{
        gap: 10,
        marginTop: 10,
        paddingTop: 8,
        borderTop: `1px solid ${BR.line}`,
      }}
    >
      {items.map((it, i) => (
        <div
          key={i}
          className="flex items-center uppercase"
          style={{
            gap: 5,
            fontFamily: BR.mono,
            fontSize: 9,
            letterSpacing: 1.2,
            color: BR.dim,
          }}
        >
          <span
            className="inline-block"
            style={{
              width: it.line ? 12 : 8,
              height: it.line ? 2 : 8,
              background: it.color,
              boxShadow: `0 0 6px ${it.color}aa`,
            }}
          />
          {it.label}
        </div>
      ))}
    </div>
  )
}
