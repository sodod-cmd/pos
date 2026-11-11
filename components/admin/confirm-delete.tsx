'use client'

import { AlertDialog } from '@base-ui/react/alert-dialog'
import { Ban, Loader2, Trash2, Undo2, type LucideIcon } from 'lucide-react'
import { useFormStatus } from 'react-dom'
import { adminButton } from '@/components/admin/ui'
import { cn } from '@/lib/utils'

// Icons are chosen by name: server pages cannot pass components to a client component.
const ICONS = { trash: Trash2, ban: Ban, undo: Undo2 } satisfies Record<string, LucideIcon>

function ConfirmButton({ confirmLabel, pendingLabel, icon: Icon }: { confirmLabel: string; pendingLabel: string; icon: LucideIcon }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={adminButton({ variant: 'dangerSolid', size: 'md' })}>
      {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Icon aria-hidden="true" />}
      {pending ? pendingLabel : confirmLabel}
    </button>
  )
}

/** A button that asks before running a destructive server action (delete, cancel, refund). */
export function ConfirmDelete({
  action,
  title,
  description,
  label = 'Устгах',
  confirmLabel = 'Тийм, устгах',
  pendingLabel = 'Устгаж байна…',
  icon = 'trash',
  iconOnly = false,
  disabled = false,
  children,
}: {
  action: (formData: FormData) => Promise<void>
  title: string
  description: string
  label?: string
  confirmLabel?: string
  pendingLabel?: string
  icon?: keyof typeof ICONS
  iconOnly?: boolean
  disabled?: boolean
  /** Extra form fields shown in the dialog, e.g. a reason. */
  children?: React.ReactNode
}) {
  const Icon = ICONS[icon]
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger
        disabled={disabled}
        className={cn(
          adminButton({ variant: iconOnly ? 'ghost' : 'danger', size: iconOnly ? 'icon' : 'md' }),
          iconOnly && 'hover:bg-destructive/10 hover:text-destructive',
        )}
        title={iconOnly ? label : undefined}
      >
        <Icon aria-hidden="true" />
        {iconOnly ? <span className="sr-only">{label}</span> : label}
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-primary-deep/40 backdrop-blur-sm transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 flex w-[28rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-2xl bg-card p-6 shadow-2xl transition-[scale,opacity] duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <div className="flex gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1.5">
              <AlertDialog.Title className="text-lg font-bold text-foreground">{title}</AlertDialog.Title>
              <AlertDialog.Description className="text-sm leading-relaxed text-muted-foreground">{description}</AlertDialog.Description>
            </div>
          </div>
          <form action={action} className="flex flex-col gap-4">
            {children}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AlertDialog.Close className={adminButton({ variant: 'outline', size: 'md' })}>Болих</AlertDialog.Close>
              <ConfirmButton confirmLabel={confirmLabel} pendingLabel={pendingLabel} icon={Icon} />
            </div>
          </form>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
