import { Link, useRouterState } from '@tanstack/react-router'
import { BR } from './br/theme'

const tabs = [
  { to: '/' as const, label: 'Upload', id: 'up' },
  { to: '/log' as const, label: 'Log', id: 'log' },
  { to: '/review' as const, label: 'Review', id: 'rev' },
  { to: '/dashboard' as const, label: 'Dashboard', id: 'dash' },
]

function UploadIcon({ active }: { active: boolean }) {
  const c = active ? BR.amber : 'rgba(215,200,180,0.45)'
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="3" y="5" width="16" height="13" rx="1.5" stroke={c} strokeWidth="1.2" />
      <circle cx="11" cy="11.5" r="3.5" stroke={c} strokeWidth="1.2" />
      <path d="M8 5l1.4-2h3.2L14 5" stroke={c} strokeWidth="1.2" />
    </svg>
  )
}

function LogIcon({ active }: { active: boolean }) {
  const c = active ? BR.amber : 'rgba(215,200,180,0.45)'
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path d="M4 5h14M4 11h14M4 17h10" stroke={c} strokeWidth="1.2" strokeLinecap="square" />
      <circle cx="2" cy="5" r="0.8" fill={c} />
      <circle cx="2" cy="11" r="0.8" fill={c} />
      <circle cx="2" cy="17" r="0.8" fill={c} />
    </svg>
  )
}

function ReviewIcon({ active }: { active: boolean }) {
  const c = active ? BR.amber : 'rgba(215,200,180,0.45)'
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="3" y="3" width="16" height="16" stroke={c} strokeWidth="1.2" />
      <path d="M7 11l3 3 5-6" stroke={c} strokeWidth="1.4" strokeLinecap="square" fill="none" />
    </svg>
  )
}

function DashIcon({ active }: { active: boolean }) {
  const c = active ? BR.amber : 'rgba(215,200,180,0.45)'
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path
        d="M3 17V9M8 17V5M13 17v-6M18 17v-4"
        stroke={c}
        strokeWidth="1.4"
        strokeLinecap="square"
      />
    </svg>
  )
}

const ICONS: Record<string, (p: { active: boolean }) => React.ReactElement> = {
  up: UploadIcon,
  log: LogIcon,
  rev: ReviewIcon,
  dash: DashIcon,
}

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 pb-[env(safe-area-inset-bottom)]"
      style={{
        borderTop: `1px solid ${BR.lineStrong}`,
        background: 'linear-gradient(to bottom, rgba(6,8,10,0.75), rgba(6,8,10,0.98))',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex pt-1">
        {tabs.map((tab) => {
          const isActive = tab.to === '/' ? pathname === '/' : pathname.startsWith(tab.to)
          const Icon = ICONS[tab.id]
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className="flex-1 flex flex-col items-center gap-1 py-2 relative"
              style={{ color: isActive ? BR.amber : BR.dim }}
            >
              {isActive && (
                <div
                  className="absolute top-0"
                  style={{
                    left: '28%',
                    right: '28%',
                    height: 1,
                    background: BR.amber,
                    boxShadow: `0 0 10px ${BR.amberGlow}`,
                  }}
                />
              )}
              <div
                style={{
                  filter: isActive ? `drop-shadow(0 0 6px ${BR.amberGlow})` : 'none',
                }}
              >
                <Icon active={isActive} />
              </div>
              <div
                className="uppercase"
                style={{
                  fontFamily: BR.mono,
                  fontSize: 9,
                  letterSpacing: 2,
                }}
              >
                {tab.label}
              </div>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
