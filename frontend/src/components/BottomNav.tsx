import { Link } from '@tanstack/react-router'

const tabs = [
  { to: '/' as const, label: 'Upload' },
  { to: '/log' as const, label: 'Log' },
  { to: '/review' as const, label: 'Review' },
  { to: '/dashboard' as const, label: 'Dashboard' },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around">
        {tabs.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            className="flex-1 py-3 text-center text-sm text-gray-500 [&.active]:text-blue-600 [&.active]:font-medium"
            activeProps={{ className: 'active' }}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
