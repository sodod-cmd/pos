import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { cancelOrderAction, recheckPayment, refundOrderAction } from '@/app/actions/admin-orders'
import { ConfirmDelete } from '@/components/admin/confirm-delete'
import { controlClass } from '@/components/admin/styles'
import { Flash, type FlashMessage } from '@/components/admin/flash'
import { OrderStatusBadge } from '@/components/admin/order-status'
import { Card, CardHeader, DetailList, PageHeader, adminButton, formatDateTime } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth/session'
import { getOrderById } from '@/lib/orders'
import { PAYMENT_SOURCE_LABELS } from '@/lib/pos-types'
import { PLACEHOLDER_IMAGE, formatMNT } from '@/lib/products'

export const metadata: Metadata = { title: 'Захиалга' }

const flashes: Record<string, FlashMessage> = {
  paid: { tone: 'success', text: 'Төлбөр баталгаажлаа. Бараа үлдэгдлээс хасагдсан.' },
  unpaid: { tone: 'warning', text: 'Төлбөр хараахан ороогүй байна. Bonum-ын төлбөр webhook-ээр ирж баталгаажна.' },
  'check-failed': { tone: 'warning', text: 'Төлбөрийн системтэй холбогдож чадсангүй. Түр хүлээгээд дахин шалгана уу.' },
  cancelled: { tone: 'success', text: 'Захиалга цуцлагдлаа.' },
  'not-pending': { tone: 'warning', text: 'Зөвхөн төлбөр хүлээгдэж буй захиалгыг цуцлах боломжтой.' },
  refunded: { tone: 'success', text: 'Буцаалт бүртгэгдэж, бараа үлдэгдэлд буцаж нэмэгдлээ.' },
  'not-paid': { tone: 'warning', text: 'Зөвхөн төлөгдсөн захиалгад буцаалт хийнэ.' },
}

function RecheckButton({ id }: { id: string }) {
  return (
    <form action={recheckPayment.bind(null, id)}>
      <button type="submit" className={adminButton({ variant: 'brand' })}>
        <RefreshCw aria-hidden="true" />
        Төлбөр шалгах
      </button>
    </form>
  )
}

export default async function OrderDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ flash?: string }> }) {
  await requireAdmin()
  const [{ id }, { flash }] = await Promise.all([params, searchParams])
  const order = await getOrderById(id)
  if (!order) notFound()

  return (
    <>
      <PageHeader
        back={{ href: '/admin/orders', label: 'Захиалга' }}
        eyebrow="Захиалга"
        title={<span className="font-mono">{order.orderNo}</span>}
        actions={
          <>
            {(order.status === 'pending' || order.status === 'cancelled') && <RecheckButton id={order.id} />}
            {order.status === 'pending' && (
              <ConfirmDelete
                action={cancelOrderAction.bind(null, order.id)}
                icon="ban"
                label="Цуцлах"
                confirmLabel="Тийм, цуцлах"
                pendingLabel="Цуцалж байна…"
                title="Захиалгыг цуцлах уу?"
                description="Эцэг эх төлбөр төлөхөө больсон бол цуцална. Хожим төлбөр орвол «Төлбөр шалгах»-аар бүртгэж болно."
              />
            )}
            {order.status === 'paid' && (
              <ConfirmDelete
                action={refundOrderAction.bind(null, order.id)}
                icon="undo"
                label="Буцаалт бүртгэх"
                confirmLabel="Буцаалт бүртгэх"
                pendingLabel="Бүртгэж байна…"
                title="Буцаалт бүртгэх үү?"
                description={`Захиалгын ${order.itemCount} ширхэг бараа үлдэгдэлд буцаж нэмэгдэнэ. Төлбөрийн мөнгийг (${formatMNT(order.paidAmount ?? order.total)}) банкаар тусад нь буцаана.`}
              >
                <label htmlFor="refund-note" className="sr-only">
                  Шалтгаан
                </label>
                <input id="refund-note" name="note" placeholder="Шалтгаан: хэмжээ тохироогүй…" className={controlClass} />
              </ConfirmDelete>
            )}
          </>
        }
      />
      <Flash message={flash ? flashes[flash] : undefined} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader title="Бараа" description={`${order.itemCount} ширхэг`} />
          <ul className="divide-y divide-border/80">
            {order.items.map((item) => (
              <li key={`${item.productId}-${item.size}`} className="flex items-center gap-4 px-5 py-3.5 md:px-6">
                <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-surface">
                  <Image src={item.image || PLACEHOLDER_IMAGE} alt="" fill sizes="48px" className="object-cover" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <Link href={`/admin/products/${item.productId}`} className="truncate text-sm font-bold hover:underline">
                    {item.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {item.categoryName}
                    {item.size && ` · Хэмжээ ${item.size}`} · {formatMNT(item.price)} × {item.qty}
                  </span>
                </span>
                <span className="text-sm font-bold">{formatMNT(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-border/80 px-5 py-4 md:px-6">
            <span className="text-sm text-muted-foreground">Нийт дүн</span>
            <span className="text-2xl font-extrabold text-primary">{formatMNT(order.total)}</span>
          </div>
        </Card>

        <Card className="self-start">
          <CardHeader title="Мэдээлэл" action={<OrderStatusBadge status={order.status} createdAt={order.createdAt} />} />
          <DetailList
            items={[
              ...(order.student?.studentName ? ([['Сурагч', order.student.studentName]] as [string, string][]) : []),
              ...(order.student?.className ? ([['Анги', order.student.className]] as [string, string][]) : []),
              ...(order.student?.studentCode ? ([['Сурагчийн код', order.student.studentCode]] as [string, string][]) : []),
              ['Үүсгэсэн', formatDateTime(order.createdAt)],
              ['Төлсөн', order.paidAt ? formatDateTime(order.paidAt) : '—'],
              ['Төлсөн дүн', order.paidAmount !== undefined ? formatMNT(order.paidAmount) : '—'],
              ...(order.cancelledAt ? ([['Цуцалсан', formatDateTime(order.cancelledAt)]] as [string, string][]) : []),
              ...(order.refundedAt ? ([['Буцаасан', formatDateTime(order.refundedAt)]] as [string, string][]) : []),
              ...(order.handledBy ? ([['Хариуцсан', order.handledBy.name]] as [string, string][]) : []),
              ...(order.note ? ([['Тэмдэглэл', order.note]] as [string, string][]) : []),
              ['Төлбөрийн хэрэгсэл', `${PAYMENT_SOURCE_LABELS[order.paymentSource ?? 'qpay']}${order.demo ? ' (туршилтын горим)' : ''}`],
              ['Нэхэмжлэх', <span key="inv" className="font-mono text-xs break-all">{order.invoiceId ?? '—'}</span>],
            ]}
          />
        </Card>
      </div>
    </>
  )
}
