import { BR } from './theme'

export function NeonBars({
  data,
  labels,
  color = BR.amber,
  glow = BR.amberGlow,
  max,
  height = 110,
}: {
  data: number[]
  labels?: string[]
  color?: string
  glow?: string
  max?: number
  height?: number
}) {
  const m = max ?? Math.max(1, ...data)
  return (
    <div className="flex items-end gap-1.5" style={{ height, padding: '8px 2px 4px' }}>
      {data.map((v, i) => {
        const h = Math.max(2, (v / m) * 100)
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              style={{
                width: '100%',
                height: `${h}%`,
                background: `linear-gradient(to top, ${color}12, ${color}35)`,
                borderTop: `1.5px solid ${color}`,
                boxShadow: `0 0 10px ${glow}, inset 0 0 8px ${color}22`,
              }}
            />
            <div
              style={{
                fontFamily: BR.mono,
                fontSize: 9,
                color: BR.dim,
                letterSpacing: 1,
              }}
            >
              {labels?.[i] ?? ''}
            </div>
          </div>
        )
      })}
    </div>
  )
}
