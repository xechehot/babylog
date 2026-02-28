import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/log')({
  component: LogPage,
})

function LogPage() {
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Log</h1>
      <p className="text-gray-500">Timeline view — coming soon</p>
    </div>
  )
}
