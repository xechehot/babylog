import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/review')({
  component: ReviewPage,
})

function ReviewPage() {
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Review</h1>
      <p className="text-gray-500">Review parsed entries — coming soon</p>
    </div>
  )
}
