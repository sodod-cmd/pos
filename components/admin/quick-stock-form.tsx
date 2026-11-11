'use client'

import { useActionState, useState } from 'react'
import { CheckCircle2, MinusCircle, PackagePlus, ClipboardCheck } from 'lucide-react'
import { FormAlert, SubmitButton } from '@/components/admin/fields'
import { controlClass, selectClass } from '@/components/admin/styles'
import { initialAdminFormState, type AdminFormState } from '@/lib/admin-form'
import { cn } from '@/lib/utils'

type Action = (state: AdminFormState, formData: FormData) => Promise<AdminFormState>

const MODES = [
  { value: 'restock', label: 'Орлого', hint: 'Шинээр ирсэн бараа нэмэх', icon: PackagePlus },
  { value: 'writeoff', label: 'Хорогдол', hint: 'Гэмтсэн, алдагдсан барааг хасах', icon: MinusCircle },
  { value: 'count', label: 'Тооллого', hint: 'Тоолсон бодит тоог оруулах', icon: ClipboardCheck },
] as const

export function QuickStockForm({ action, sizes }: { action: Action; sizes: { size: string; stock: number }[] }) {
  const [state, formAction] = useActionState(action, initialAdminFormState)
  const [mode, setMode] = useState<(typeof MODES)[number]['value']>('restock')
  const sized = sizes.some((s) => s.size !== '')

  return (
    <form action={formAction} className="flex flex-col gap-4" key={state.status === 'success' ? state.attempt : undefined}>
      <input type="hidden" name="mode" value={mode} />
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface p-1" role="radiogroup" aria-label="Үйлдэл">
        {MODES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            onClick={() => setMode(value)}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold transition-colors',
              mode === value ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-primary',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">{MODES.find((m) => m.value === mode)?.hint}</p>

      <div className="grid grid-cols-2 gap-3">
        {sized ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="qs-size" className="text-sm font-semibold">
              Хэмжээ
            </label>
            <select id="qs-size" name="size" defaultValue={state.values?.size ?? sizes[0]?.size} className={selectClass}>
              {sizes.map((s) => (
                <option key={s.size} value={s.size}>
                  {s.size} · {s.stock} ш
                </option>
              ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="size" value="" />
        )}
        <div className={cn('flex flex-col gap-1.5', !sized && 'col-span-2')}>
          <label htmlFor="qs-qty" className="text-sm font-semibold">
            {mode === 'count' ? 'Тоолсон тоо' : 'Тоо ширхэг'}
          </label>
          <input
            id="qs-qty"
            name="qty"
            inputMode="numeric"
            placeholder="0"
            aria-invalid={state.errors?.qty ? true : undefined}
            className={controlClass}
          />
        </div>
      </div>
      {state.errors?.qty && <p className="text-sm font-medium text-destructive">{state.errors.qty}</p>}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="qs-note" className="text-sm font-semibold">
          Тэмдэглэл <span className="font-normal text-muted-foreground">(заавал биш)</span>
        </label>
        <input id="qs-note" name="note" placeholder="Нийлүүлэгч, шалтгаан…" className={controlClass} />
      </div>
      {state.status === 'error' && <FormAlert state={state} />}
      {state.status === 'success' && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-success/25 bg-success/10 px-3 py-2.5 text-sm font-medium text-success">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          {state.message}
        </p>
      )}
      <SubmitButton variant="brand" className="w-full">
        Бүртгэх
      </SubmitButton>
    </form>
  )
}
