import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { BottomNav } from '../components/BottomNav'
import { TopBar } from '../components/TopBar'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isProfilePage = pathname.endsWith('/profile')

  return (
    <div className="min-h-screen bg-gray-50">
      {!isProfilePage && <TopBar />}
      <div className="pb-16">
        <Outlet />
      </div>
      {!isProfilePage && <BottomNav />}
    </div>
  )
}
