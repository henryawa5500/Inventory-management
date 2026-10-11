import { Minus, Plus } from 'lucide-react'

type StepperProps = {
  value: number
  min?: number
  max?: number
  onChange: (next: number) => void
}

export function Stepper({ value, min = 0, max = 99, onChange }: StepperProps) {
  return (
    <div className="flex items-center overflow-hidden rounded-lg border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900">
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center text-neutral-700 dark:text-neutral-200"
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus size={16} strokeWidth={2.5} />
      </button>
      <div className="min-w-14 border-x border-neutral-300 px-3 text-center text-base font-semibold text-neutral-900 dark:border-neutral-700 dark:text-white">
        {value}
      </div>
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center text-neutral-700 dark:text-neutral-200"
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus size={16} strokeWidth={2.5} />
      </button>
    </div>
  )
}
