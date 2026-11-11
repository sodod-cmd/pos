// Client-safe order constants, shared by lib/orders.ts and admin components.
export type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'refunded'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Төлбөр хүлээгдэж буй',
  paid: 'Төлөгдсөн',
  cancelled: 'Цуцлагдсан',
  refunded: 'Буцаагдсан',
}

/** Invoices nobody paid within this time are treated as abandoned. */
export const PENDING_STALE_MS = 30 * 60 * 1000
