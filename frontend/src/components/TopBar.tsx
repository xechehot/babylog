import { Link } from '@tanstack/react-router'
import { BR } from './br/theme'

export function TopBar() {
  return (
    <header
      className="sticky top-0 z-30"
      style={{
        background: 'linear-gradient(to bottom, rgba(6,8,10,0.95), rgba(6,8,10,0.75))',
        borderBottom: `1px solid ${BR.lineStrong}`,
        backdropFilter: 'blur(10px)',
      }}
    >
      <div className="flex items-center justify-between px-5 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block rounded-full"
            style={{
              width: 8,
              height: 8,
              background: BR.amber,
              boxShadow: `0 0 10px ${BR.amberGlow}`,
              animation: 'brPulse 1.4s infinite ease-in-out',
            }}
          />
          <span
            className="uppercase"
            style={{
              fontFamily: BR.display,
              fontSize: 15,
              fontWeight: 500,
              letterSpacing: 2,
              color: BR.text,
              textShadow: `0 0 10px ${BR.amberGlow}`,
            }}
          >
            babylog
          </span>
          <span
            className="uppercase"
            style={{
              fontFamily: BR.mono,
              fontSize: 9,
              letterSpacing: 2.5,
              color: BR.dim,
            }}
          >
            // UNIT-04RZ
          </span>
        </Link>
        <Link
          to="/profile"
          className="p-2 -m-2 transition-colors"
          aria-label="Profile"
          style={{ color: BR.amber }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.2}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
            />
          </svg>
        </Link>
      </div>
    </header>
  )
}
