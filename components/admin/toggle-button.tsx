'use client'

import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useFormStatus } from 'react-dom'
import { adminButton } from '@/components/admin/ui'

function Inner({ active, compact }: { active: boolean; compact?: boolean }) {
  const { pending } = useFormStatus()
  const label = active ? 'Борлуулалтаас нуух' : 'Борлуулалтад гаргах'
  const Icon = pending ? Loader2 : active ? EyeOff : Eye
  return (
    <button
      type="submit"
      disabled={pending}
      title={compact ? label : undefined}
      className={adminButton({ variant: compact ? 'ghost' : 'outline', size: compact ? 'icon' : 'md' })}
    >
      <Icon className={pending ? 'animate-spin' : undefined} aria-hidden="true" />
      {compact ? <span className="sr-only">{label}</span> : label}
    </button>
  )
}

/** Shows or hides a product on the POS without leaving the page. */
export function ActiveToggle({ action, active, compact }: { action: () => Promise<void>; active: boolean; compact?: boolean }) {
  return (
    <form action={action}>
      <Inner active={active} compact={compact} />
    </form>
  )
}
