export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center" role="status">
      <span className="text-6xl text-neutral-200 mb-4" aria-hidden="true">&#9825;</span>
      <h2 className="text-lg font-semibold text-neutral-500">No items found</h2>
      <p className="mt-1 text-sm text-neutral-400">
        Try adjusting your filters or search query.
      </p>
    </div>
  )
}
