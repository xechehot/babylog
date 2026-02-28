import { createRootRoute, Outlet } from '@tanstack/react-router'
import { BottomNav } from '../components/BottomNav'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="pb-16">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  )
}
