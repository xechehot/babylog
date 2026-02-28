import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: UploadPage,
})

function UploadPage() {
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">babylog</h1>
      <p className="text-gray-500">Upload page — coming soon</p>
    </div>
  )
}
