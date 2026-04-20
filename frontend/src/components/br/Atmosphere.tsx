export function Atmosphere() {
  return (
    <>
      {/* vignette — warm amber top, cool cyan bottom */}
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(130% 90% at 50% 0%, rgba(255,179,71,0.10) 0%, rgba(255,179,71,0.02) 25%, rgba(0,0,0,0) 55%), radial-gradient(120% 100% at 50% 110%, rgba(100,240,232,0.08) 0%, rgba(0,0,0,0) 50%)',
        }}
      />
      {/* scanlines */}
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, rgba(255,255,255,0.025) 0 1px, transparent 1px 3px)',
          mixBlendMode: 'screen',
        }}
      />
      {/* film grain */}
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          opacity: 0.16,
          mixBlendMode: 'overlay',
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.95  0 0 0 0 0.8  0 0 0 0 0.55  0 0 0 1 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.5'/></svg>\")",
        }}
      />
    </>
  )
}
