import { BR } from './theme'

export function PageHead({
  kicker,
  title,
  meta,
  accent = BR.amber,
}: {
  kicker: string
  title: React.ReactNode
  meta?: (string | null | undefined)[]
  accent?: string
}) {
  return (
    <div className="px-5 pt-6 pb-3 relative">
      <div
        className="flex items-center gap-2 uppercase"
        style={{
          fontFamily: BR.mono,
          fontSize: 10,
          letterSpacing: 3,
          color: accent,
          textShadow: `0 0 10px ${accent}55`,
        }}
      >
        <span
          className="inline-block rounded-full"
          style={{
            width: 6,
            height: 6,
            background: accent,
            boxShadow: `0 0 8px ${accent}`,
          }}
        />
        {kicker}
      </div>
      <div
        className="mt-2.5"
        style={{
          fontFamily: BR.display,
          fontSize: 34,
          fontWeight: 500,
          lineHeight: 1.02,
          letterSpacing: -1,
          color: BR.text,
        }}
      >
        {title}
      </div>
      {meta && meta.filter(Boolean).length > 0 && (
        <div
          className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 uppercase"
          style={{
            fontFamily: BR.mono,
            fontSize: 10,
            letterSpacing: 1.5,
            color: BR.dim,
          }}
        >
          {meta.filter(Boolean).map((m, i) => (
            <span key={i} className="flex items-center gap-2.5">
              {i > 0 && <span style={{ color: BR.lineStrong }}>/</span>}
              <span>{m}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
