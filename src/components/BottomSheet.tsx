export function BottomSheet({ children, open }: { children: React.ReactNode; open: boolean }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-30 bg-black/40 p-4">
      <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-white p-4 shadow-soft dark:bg-neutral-900">{children}</div>
    </div>
  )
}
