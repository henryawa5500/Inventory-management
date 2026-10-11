export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center dark:border-neutral-700 dark:bg-neutral-900">
      <div className="text-lg font-bold text-neutral-900 dark:text-white">{title}</div>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{body}</p>
    </div>
  )
}
