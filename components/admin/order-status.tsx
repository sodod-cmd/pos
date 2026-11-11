import { Badge } from '@/components/admin/ui'
import { ORDER_STATUS_LABELS, PENDING_STALE_MS, type OrderStatus } from '@/lib/order-status'

export function OrderStatusBadge({ status, createdAt }: { status: OrderStatus; createdAt?: Date }) {
  if (status === 'pending' && createdAt && Date.now() - createdAt.getTime() > PENDING_STALE_MS) {
    return <Badge tone="neutral">Төлөгдөөгүй</Badge>
  }
  const tone = status === 'paid' ? 'success' : status === 'pending' ? 'warning' : status === 'refunded' ? 'danger' : 'neutral'
  return <Badge tone={tone}>{ORDER_STATUS_LABELS[status]}</Badge>
}
