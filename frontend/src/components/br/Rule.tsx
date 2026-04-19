import { BR } from './theme'

export function Rule({ label, accent = BR.amber }: { label: string; accent?: string }) {
  return (
    <div className="flex items-center gap-2.5 px-5 pt-4 pb-2">
      <div className="h-px flex-[0_0_14px]" style={{ background: BR.lineStrong }} />
      <div
        className="uppercase"
        style={{
          fontFamily: BR.mono,
          fontSize: 9,
          letterSpacing: 2.5,
          color: accent,
        }}
      >
        [ {label} ]
      </div>
      <div className="h-px flex-1" style={{ background: BR.lineStrong }} />
    </div>
  )
}
