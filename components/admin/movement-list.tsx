import Link from 'next/link'
import { History } from 'lucide-react'
import { Badge, EmptyState, formatDateTime } from '@/components/admin/ui'
import { MOVEMENT_LABELS, type MovementType, type StockMovement } from '@/lib/inventory'
import { cn } from '@/lib/utils'

const typeTone: Record<MovementType, 'success' | 'warning' | 'danger' | 'neutral' | 'brand'> = {
  initial: 'neutral',
  restock: 'success',
  sale: 'brand',
  return: 'success',
  adjust: 'warning',
  writeoff: 'danger',
}

export function MovementList({ items, showProduct = true }: { items: StockMovement[]; showProduct?: boolean }) {
  if (items.length === 0) {
    return <EmptyState icon={History} title="Хөдөлгөөн алга" text="Орлого, борлуулалт, тооллого энд бүртгэгдэнэ." />
  }
  return (
    <ul className="divide-y divide-border/80">
      {items.map((m) => (
        <li key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3 md:grid-cols-[9.5rem_minmax(0,1fr)_8rem_5rem_5rem] md:px-6">
          <span className="order-3 text-xs text-muted-foreground md:order-none">{formatDateTime(m.createdAt)}</span>
          <span className="flex min-w-0 flex-col gap-0.5">
            {showProduct ? (
              <Link href={`/admin/products/${m.productId}`} className="truncate text-sm font-bold hover:underline">
                {m.productName}
                {m.size && <span className="font-semibold text-muted-foreground"> · {m.size}</span>}
              </Link>
            ) : (
              <span className="text-sm font-bold">{m.size ? `Хэмжээ ${m.size}` : 'Үлдэгдэл'}</span>
            )}
            <span className="truncate text-xs text-muted-foreground">
              {m.orderNo ? (
                <Link href={`/admin/orders?q=${encodeURIComponent(m.orderNo)}`} className="hover:text-primary hover:underline">
                  {m.orderNo}
                </Link>
              ) : (
                m.note || '—'
              )}
              {m.actor && ` · ${m.actor.name}`}
            </span>
          </span>
          <span className="order-4 md:order-none">
            <Badge tone={typeTone[m.type]}>{MOVEMENT_LABELS[m.type]}</Badge>
          </span>
          <span className={cn('text-right text-sm font-bold', m.delta > 0 ? 'text-success' : 'text-destructive')}>
            {m.delta > 0 ? '+' : ''}
            {m.delta}
          </span>
          <span className="hidden text-right text-sm text-muted-foreground md:block">→ {m.balanceAfter}</span>
        </li>
      ))}
    </ul>
  )
}
