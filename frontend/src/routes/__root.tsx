import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { BottomNav } from '../components/BottomNav'
import { TopBar } from '../components/TopBar'
import { Atmosphere } from '../components/br/Atmosphere'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isProfilePage = pathname.endsWith('/profile')

  return (
    <div className="relative min-h-screen" style={{ background: '#06080a', color: '#f0e3cc' }}>
      <Atmosphere />
      <div className="relative z-10">
        {!isProfilePage && <TopBar />}
        <div className="pb-20">
          <Outlet />
        </div>
        {!isProfilePage && <BottomNav />}
      </div>
    </div>
  )
}
