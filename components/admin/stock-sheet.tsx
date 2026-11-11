'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import { CheckCircle2, ClipboardCheck, MinusCircle, PackagePlus, Save } from 'lucide-react'
import { FormAlert, SubmitButton } from '@/components/admin/fields'
import { controlClass } from '@/components/admin/styles'
import { Card } from '@/components/admin/ui'
import { initialAdminFormState, type AdminFormState } from '@/lib/admin-form'
import { stockStatus } from '@/lib/catalog-status'
import { PLACEHOLDER_IMAGE } from '@/lib/products'
import { cn } from '@/lib/utils'

type Action = (state: AdminFormState, formData: FormData) => Promise<AdminFormState>
type Mode = 'restock' | 'writeoff' | 'count'

export type SheetProduct = {
  id: string
  name: string
  categoryName: string
  image?: string
  threshold: number
  variants: { size: string; stock: number }[]
}

const MODES: { value: Mode; label: string; text: string; icon: typeof PackagePlus }[] = [
  { value: 'restock', label: 'Орлого авах', text: 'Нийлүүлэгчээс ирсэн тоог хэмжээ бүрт бичнэ. Одоогийн үлдэгдэл дээр нэмэгдэнэ.', icon: PackagePlus },
  { value: 'count', label: 'Тооллого', text: 'Тавиур дээр тоолсон бодит тоог бичнэ. Хоосон нүд өөрчлөгдөхгүй.', icon: ClipboardCheck },
  { value: 'writeoff', label: 'Хорогдол', text: 'Гэмтсэн, алдагдсан тоог бичнэ. Үлдэгдлээс хасагдана.', icon: MinusCircle },
]

const key = (productId: string, size: string) => `${productId}|${size}`

export function StockSheet({ action, products }: { action: Action; products: SheetProduct[] }) {
  const [state, formAction] = useActionState(action, initialAdminFormState)
  const [mode, setMode] = useState<Mode>('restock')
  const [values, setValues] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')

  // A saved sheet starts empty again; the new stock arrives with the refreshed page.
  useEffect(() => {
    if (state.status === 'success') {
      setValues({})
      setNote('')
    }
  }, [state])

  const entries = Object.entries(values).filter(([, v]) => v !== '' && (mode === 'count' || Number(v) > 0))
  const units = entries.reduce((sum, [, v]) => sum + Number(v), 0)
  const current = MODES.find((m) => m.value === mode)!

  function submit(formData: FormData) {
    const changes = entries.map(([k, v]) => {
      const [productId, ...rest] = k.split('|')
      return { productId, size: rest.join('|'), qty: Number(v) }
    })
    formData.set('mode', mode)
    formData.set('note', note)
    formData.set('changes', JSON.stringify(changes))
    formAction(formData)
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4 p-4 md:p-5">
        <div className="grid gap-1 rounded-xl bg-surface p-1 sm:grid-cols-3" role="radiogroup" aria-label="Үйлдэл">
          {MODES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => {
                setMode(value)
                setValues({})
              }}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
                mode === value ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-primary',
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{current.text}</p>
        {state.status === 'success' && (
          <p role="status" className="flex items-start gap-2 rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-sm font-medium text-success">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {state.message}
          </p>
        )}
        <FormAlert state={state} />
      </Card>

      <Card>
        <ul className="divide-y divide-border/80">
          {products.map((product) => (
            <li key={product.id} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-start md:px-5">
              <Link href={`/admin/products/${product.id}`} className="flex min-w-0 items-center gap-3 md:w-60 md:shrink-0">
                <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-surface">
                  <Image src={product.image || PLACEHOLDER_IMAGE} alt="" fill sizes="48px" className="object-cover" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="line-clamp-2 text-sm leading-snug font-bold hover:underline">{product.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {product.categoryName} · хязгаар {product.threshold}
                  </span>
                </span>
              </Link>
              <div className="flex flex-1 flex-wrap gap-2">
                {product.variants.map((variant) => {
                  const k = key(product.id, variant.size)
                  const status = stockStatus(variant.stock, product.threshold)
                  const value = values[k] ?? ''
                  const n = Number(value)
                  const after = value === '' ? null : mode === 'restock' ? variant.stock + n : mode === 'writeoff' ? variant.stock - n : n
                  return (
                    <label
                      key={k}
                      className={cn(
                        'flex w-[5.25rem] flex-col gap-1 rounded-xl border p-1.5 transition-colors',
                        value !== '' ? 'border-highlight bg-highlight/10' : status === 'out' ? 'border-destructive/30 bg-destructive/5' : status === 'low' ? 'border-warning/60 bg-warning/10' : 'border-border bg-card',
                      )}
                    >
                      <span className="flex items-baseline justify-between gap-1 px-1">
                        <span className="text-xs font-bold">{variant.size || 'Тоо'}</span>
                        <span
                          className={cn('text-xs font-semibold', status === 'out' ? 'text-destructive' : status === 'low' ? 'text-warning-foreground' : 'text-muted-foreground')}
                          title="Одоогийн үлдэгдэл"
                        >
                          {variant.stock}
                        </span>
                      </span>
                      <input
                        inputMode="numeric"
                        value={value}
                        placeholder={mode === 'count' ? String(variant.stock) : '+0'}
                        onChange={(e) => {
                          const next = e.target.value.replace(/[^\d]/g, '').slice(0, 5)
                          setValues((cur) => ({ ...cur, [k]: next }))
                        }}
                        aria-label={`${product.name}${variant.size ? ` ${variant.size}` : ''}: ${current.label}`}
                        className={cn(controlClass, 'h-9 rounded-lg px-1.5 py-1 text-center text-sm font-semibold')}
                      />
                      <span className={cn('min-h-3.5 text-center text-[10px] font-semibold', after !== null && after < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                        {after !== null ? `→ ${after}` : ''}
                      </span>
                    </label>
                  )
                })}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-3 border-t border-border/80 bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:flex-row sm:items-center sm:rounded-2xl sm:border">
        <label htmlFor="sheet-note" className="sr-only">
          Тэмдэглэл
        </label>
        <input
          id="sheet-note"
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 200))}
          placeholder={mode === 'restock' ? 'Тэмдэглэл: нийлүүлэгч, падааны дугаар…' : mode === 'count' ? 'Тэмдэглэл: 11-р сарын тооллого…' : 'Тэмдэглэл: шалтгаан…'}
          className={cn(controlClass, 'h-11 flex-1 py-2')}
        />
        <span className="text-sm whitespace-nowrap text-muted-foreground">
          {entries.length} хэмжээ{mode !== 'count' && ` · ${units} ширхэг`}
        </span>
        <SubmitButton className={cn(entries.length === 0 && 'pointer-events-none opacity-60')}>
          <Save aria-hidden="true" />
          {current.label} хадгалах
        </SubmitButton>
      </div>
    </form>
  )
}
