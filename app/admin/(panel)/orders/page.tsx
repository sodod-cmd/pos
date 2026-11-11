import type { Metadata } from 'next'
import Link from 'next/link'
import { Download, GraduationCap, ReceiptText, Search } from 'lucide-react'
import { OrderStatusBadge } from '@/components/admin/order-status'
import { Badge, Card, EmptyState, FilterTabs, PageHeader, Pagination, adminButton, formatDateTime, formatNumber } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth/session'
import { ORDER_STATUS_LABELS, countOrdersByStatus, isOrderRange, isOrderStatus, listOrders, type OrderRange, type OrderStatus } from '@/lib/orders'
import { formatStudent } from '@/lib/pos-types'
import { formatMNT } from '@/lib/products'

export const metadata: Metadata = { title: 'Захиалга' }

type Params = { status?: string; range?: string; q?: string; page?: string }

const RANGES: { key: OrderRange; label: string }[] = [
  { key: 'today', label: 'Өнөөдөр' },
  { key: '7d', label: '7 хоног' },
  { key: '30d', label: '30 хоног' },
  { key: 'month', label: 'Энэ сар' },
  { key: 'all', label: 'Бүгд' },
]

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin()
  const params = await searchParams
  const status = isOrderStatus(params.status) ? params.status : undefined
  const range: OrderRange = isOrderRange(params.range) ? params.range : '30d'
  const q = params.q?.trim().slice(0, 60) || undefined
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1)
  const [result, counts] = await Promise.all([listOrders({ status, range, q, page }), countOrdersByStatus(range)])

  function href(patch: Partial<Params>) {
    const merged: Params = { status, range: range === '30d' ? undefined : range, q, ...patch }
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v)
    const s = sp.toString()
    return s ? `/admin/orders?${s}` : '/admin/orders'
  }

  const exportParams = new URLSearchParams()
  if (status) exportParams.set('status', status)
  exportParams.set('range', range)
  if (q) exportParams.set('q', q)
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <>
      <PageHeader
        eyebrow="Борлуулалт"
        title="Захиалга, худалдан авалт"
        description="Борлуулалтын цэгээр үүссэн QPay нэхэмжлэх бүр. Төлөгдсөн захиалгын бараа үлдэгдлээс автоматаар хасагдана."
        actions={
          <a href={`/admin/orders/export?${exportParams}`} className={adminButton({ variant: 'outline' })}>
            <Download aria-hidden="true" />
            Excel (CSV) татах
          </a>
        }
      />

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Орлого', value: formatMNT(result.paid.revenue) },
          { label: 'Төлөгдсөн захиалга', value: formatNumber(result.paid.count) },
          { label: 'Зарагдсан бараа', value: `${formatNumber(result.paid.items)} ш` },
        ].map((s) => (
          <div key={s.label} className="flex flex-col gap-1 rounded-2xl border border-border/80 bg-card px-5 py-4">
            <dt className="text-xs font-medium text-muted-foreground">
              {s.label} · {RANGES.find((r) => r.key === range)?.label.toLowerCase()}
            </dt>
            <dd className="text-2xl font-extrabold">{s.value}</dd>
          </div>
        ))}
      </dl>

      <Card>
        <div className="flex flex-col gap-3 border-b border-border/80 p-3 md:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <FilterTabs label="Хугацаа" tabs={RANGES.map((r) => ({ href: href({ range: r.key === '30d' ? undefined : r.key, page: undefined }), label: r.label, active: range === r.key }))} />
            <form role="search" className="relative lg:w-72">
              {status && <input type="hidden" name="status" value={status} />}
              {range !== '30d' && <input type="hidden" name="range" value={range} />}
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="q" className="sr-only">
                Захиалга хайх
              </label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={q}
                placeholder="Дугаар, бараа, сурагчийн нэр, анги…"
                className="h-10 w-full rounded-xl border border-input/80 bg-card pr-3 pl-9 text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none"
              />
            </form>
          </div>
          <FilterTabs
            label="Төлөв"
            tabs={[
              { href: href({ status: undefined, page: undefined }), label: 'Бүгд', count: allCount, active: !status },
              ...(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((s) => ({
                href: href({ status: s, page: undefined }),
                label: ORDER_STATUS_LABELS[s],
                count: counts[s],
                active: status === s,
              })),
            ]}
          />
        </div>

        {result.items.length === 0 ? (
          <EmptyState icon={ReceiptText} title="Захиалга алга" text={q ? `«${q}» гэсэн хайлтад тохирох захиалга алга.` : 'Энэ хугацаанд захиалга үүсээгүй байна.'} />
        ) : (
          <>
            <div className="hidden grid-cols-[12.5rem_minmax(0,1fr)_9rem_8rem_9rem] gap-4 border-b border-border/80 px-6 py-2.5 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase lg:grid">
              <span>Дугаар</span>
              <span>Бараа</span>
              <span>Огноо</span>
              <span className="text-right">Дүн</span>
              <span className="text-right">Төлөв</span>
            </div>
            <ul className="divide-y divide-border/80">
              {result.items.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3.5 transition-colors hover:bg-surface/60 lg:grid-cols-[12.5rem_minmax(0,1fr)_9rem_8rem_9rem] lg:px-6"
                  >
                    <span className="flex items-center gap-2 font-mono text-sm font-semibold whitespace-nowrap text-primary">
                      {order.orderNo}
                      {order.demo && <Badge className="px-1.5 py-0 font-sans text-[10px]">Туршилт</Badge>}
                    </span>
                    <span className="order-3 col-span-2 flex min-w-0 flex-col lg:order-none lg:col-span-1">
                      <span className="truncate text-sm text-muted-foreground">
                        {order.items.map((item) => `${item.name}${item.size ? ` (${item.size})` : ''} ×${item.qty}`).join(', ')}
                      </span>
                      {order.student && (
                        <span className="flex items-center gap-1 truncate text-xs font-medium text-foreground">
                          <GraduationCap className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                          {formatStudent(order.student)}
                        </span>
                      )}
                    </span>
                    <span className="order-4 text-xs text-muted-foreground lg:order-none lg:text-sm">{formatDateTime(order.paidAt ?? order.createdAt)}</span>
                    <span className="text-right text-sm font-bold">{formatMNT(order.total)}</span>
                    <span className="order-5 justify-self-end lg:order-none">
                      <OrderStatusBadge status={order.status} createdAt={order.createdAt} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination page={page} pages={result.pages} href={(p) => href({ page: p > 1 ? String(p) : undefined })} />
          </>
        )}
      </Card>
    </>
  )
}
