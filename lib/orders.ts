import 'server-only'
import { randomBytes } from 'node:crypto'
import { ObjectId, type Filter, type WithId } from 'mongodb'
import { collections, escapeRegex } from '@/lib/db'
import { moveOrderStock, type ActorRef } from '@/lib/inventory'
import { ORDER_STATUS_LABELS, PENDING_STALE_MS, type OrderStatus } from '@/lib/order-status'
import { checkInvoicePayment } from '@/lib/payment'
import type { OrderItemInput, PaymentSource, StudentInfo } from '@/lib/pos-types'
import { ORDER_PREFIX } from '@/lib/school'
import { startOfDay, startOfMonth } from '@/lib/time'

/* ───────────────────────────── Types ───────────────────────────── */

export { ORDER_STATUS_LABELS, PENDING_STALE_MS, type OrderStatus }

export type OrderItemDoc = {
  productId: ObjectId
  name: string
  categoryId: ObjectId
  categoryName: string
  size: string
  price: number
  qty: number
  lineTotal: number
  image?: string
}

export type OrderDoc = {
  orderNo: string
  status: OrderStatus
  items: OrderItemDoc[]
  total: number
  itemCount: number
  invoiceId?: string
  /** Which provider issued the invoice. Orders made before Bonum was added have none: QPay. */
  paymentSource?: PaymentSource
  demo: boolean
  /** Optional: who the purchase is for, entered by the cashier. */
  student?: StudentInfo
  paidAmount?: number
  paidAt?: Date
  cancelledAt?: Date
  refundedAt?: Date
  note?: string
  handledBy?: ActorRef
  createdAt: Date
  updatedAt: Date
}

export type OrderItem = Omit<OrderItemDoc, 'productId' | 'categoryId'> & { productId: string; categoryId: string }
export type Order = Omit<OrderDoc, 'items'> & { id: string; items: OrderItem[] }

const MAX_LINE_QTY = 20
const MAX_PRODUCT_QTY = 50
const MAX_LINES = 40

function objectId(id: string) {
  return ObjectId.isValid(id) ? new ObjectId(id) : null
}

function toOrder({ _id, items, ...rest }: WithId<OrderDoc>): Order {
  return {
    ...rest,
    id: _id.toHexString(),
    items: items.map(({ productId, categoryId, ...item }) => ({
      ...item,
      productId: productId.toHexString(),
      categoryId: categoryId.toHexString(),
    })),
  }
}

/* ─────────────────────────── Checkout ─────────────────────────── */

type PricedCart = { error: string } | { error?: undefined; items: OrderItemDoc[]; total: number; itemCount: number; description: string }

/** Prices a cart from the database and checks every size is in stock. Never trusts client prices. */
export async function priceCart(raw: unknown): Promise<PricedCart> {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_LINES) return { error: 'Сагс хоосон эсвэл буруу байна' }

  const { products, categories } = await collections()
  const ids = [...new Set((raw as Partial<OrderItemInput>[]).map((item) => item?.productId).filter((id) => typeof id === 'string'))]
  const objectIds = ids.map(objectId).filter((id): id is ObjectId => id !== null)
  const [docs, cats] = await Promise.all([
    products.find({ _id: { $in: objectIds }, active: true }).toArray(),
    categories.find().toArray(),
  ])
  const productById = new Map(docs.map((doc) => [doc._id.toHexString(), doc]))
  const categoryById = new Map(cats.map((cat) => [cat._id.toHexString(), cat]))

  const perVariant = new Map<string, number>()
  const perProduct = new Map<string, number>()
  const items: OrderItemDoc[] = []

  for (const line of raw as Partial<OrderItemInput>[]) {
    const product = typeof line?.productId === 'string' ? productById.get(line.productId) : undefined
    if (!product) return { error: 'Бүтээгдэхүүн олдсонгүй эсвэл худалдаанаас хасагдсан байна' }

    const qty = line.qty
    if (!Number.isInteger(qty) || (qty as number) < 1 || (qty as number) > MAX_LINE_QTY) return { error: 'Тоо ширхэг буруу байна' }

    const size = typeof line.size === 'string' ? line.size : ''
    const variant = product.variants.find((v) => v.size === size)
    if (!variant) return { error: size ? `${product.name}: ${size} хэмжээ байхгүй байна` : `${product.name}: хэмжээ сонгоогүй байна` }

    const variantKey = `${product._id.toHexString()}:${size}`
    const variantQty = (perVariant.get(variantKey) ?? 0) + (qty as number)
    if (variantQty > variant.stock) {
      return {
        error:
          variant.stock <= 0
            ? `${product.name}${size ? ` (${size})` : ''} дууссан байна`
            : `${product.name}${size ? ` (${size})` : ''}: зөвхөн ${variant.stock} ширхэг үлдсэн байна`,
      }
    }
    perVariant.set(variantKey, variantQty)

    const productQty = (perProduct.get(product._id.toHexString()) ?? 0) + (qty as number)
    if (productQty > MAX_PRODUCT_QTY) return { error: 'Тоо ширхэг хэтэрсэн байна' }
    perProduct.set(product._id.toHexString(), productQty)

    items.push({
      productId: product._id,
      name: product.name,
      categoryId: product.categoryId,
      categoryName: categoryById.get(product.categoryId.toHexString())?.name ?? '',
      size,
      price: product.price,
      qty: qty as number,
      lineTotal: product.price * (qty as number),
      image: product.images[0],
    })
  }

  return {
    items,
    total: items.reduce((sum, item) => sum + item.lineTotal, 0),
    itemCount: items.reduce((sum, item) => sum + item.qty, 0),
    description: items
      .map((item) => `${item.name}${item.size ? ` ${item.size}` : ''} x${item.qty}`)
      .join(', ')
      .slice(0, 200),
  }
}

function newOrderNo() {
  // Time-ordered and unguessable enough for a receipt number.
  return `${ORDER_PREFIX}-${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString('hex').toUpperCase()}`
}

export async function createPendingOrder(cart: { items: OrderItemDoc[]; total: number; itemCount: number }, student?: StudentInfo) {
  const { orders } = await collections()
  const now = new Date()
  const orderNo = newOrderNo()
  await orders.insertOne({
    orderNo,
    status: 'pending',
    items: cart.items,
    total: cart.total,
    itemCount: cart.itemCount,
    demo: false,
    ...(student ? { student } : {}),
    createdAt: now,
    updatedAt: now,
  })
  return orderNo
}

export async function attachInvoice(orderNo: string, invoice: { invoiceId: string; source: PaymentSource; demo: boolean }) {
  const { orders } = await collections()
  await orders.updateOne(
    { orderNo },
    { $set: { invoiceId: invoice.invoiceId, paymentSource: invoice.source, demo: invoice.demo, updatedAt: new Date() } },
  )
}

/** Used when the payment provider could not issue an invoice, so the order never existed for the customer. */
export async function discardOrder(orderNo: string) {
  const { orders } = await collections()
  await orders.deleteOne({ orderNo, status: 'pending' })
}

export async function findOrderByInvoice(invoiceId: string) {
  const { orders } = await collections()
  const doc = await orders.findOne({ invoiceId })
  return doc ? toOrder(doc) : null
}

export async function findOrderByNo(orderNo: string) {
  const { orders } = await collections()
  const doc = await orders.findOne({ orderNo })
  return doc ? toOrder(doc) : null
}

/**
 * Marks an order paid and takes its goods out of stock. The status change is the lock:
 * only the request that moves the order out of pending/cancelled deducts stock, so the
 * cashier's check, the QPay callback, the Bonum webhook and an admin re-check can race safely.
 */
async function markPaid(orderId: ObjectId, paidAmount: number) {
  const { orders } = await collections()
  const now = new Date()
  const doc = await orders.findOneAndUpdate(
    { _id: orderId, status: { $in: ['pending', 'cancelled'] } },
    { $set: { status: 'paid', paidAmount, paidAt: now, updatedAt: now }, $unset: { cancelledAt: '' } },
    { returnDocument: 'after' },
  )
  if (!doc) return false
  if (paidAmount < doc.total) console.warn(`[orders] ${doc.orderNo}: paid ${paidAmount} of ${doc.total}`)
  await moveOrderStock('sale', doc.orderNo, doc.items, null)
  return true
}

/** Asks the payment provider whether the order's invoice is paid and records the payment once. */
export async function syncPayment(order: Pick<Order, 'id' | 'status' | 'invoiceId' | 'paidAmount' | 'paymentSource'>) {
  if (order.status === 'paid' || order.status === 'refunded') return { paid: true, paidAmount: order.paidAmount ?? 0 }
  if (!order.invoiceId) return { paid: false, paidAmount: 0 }
  const result = await checkInvoicePayment(order.paymentSource ?? 'qpay', order.invoiceId)
  if (result.paid) await markPaid(new ObjectId(order.id), result.paidAmount)
  return result
}

/**
 * Records a payment the provider pushed to us (Bonum webhook, already checksum-verified).
 * The order is found by its order number, which we sent as Bonum's transactionId, and
 * must have been invoiced through the same provider.
 */
export async function recordProviderPayment(input: { source: PaymentSource; orderNo: string; invoiceId?: string; paidAmount?: number }) {
  const { orders } = await collections()
  const doc = await orders.findOne({ orderNo: input.orderNo, paymentSource: input.source })
  if (!doc) return 'not-found' as const
  if (input.invoiceId && doc.invoiceId && input.invoiceId !== doc.invoiceId) {
    console.warn(`[orders] ${doc.orderNo}: webhook invoice ${input.invoiceId} differs from ${doc.invoiceId}`)
  }
  if (doc.status === 'paid' || doc.status === 'refunded') return 'already-paid' as const
  const paidAmount = input.paidAmount && input.paidAmount > 0 ? input.paidAmount : doc.total
  return (await markPaid(doc._id, paidAmount)) ? ('paid' as const) : ('already-paid' as const)
}

/* ─────────────────────────── Admin actions ─────────────────────────── */

export async function cancelOrder(id: string, actor: ActorRef) {
  const _id = objectId(id)
  if (!_id) return false
  const { orders } = await collections()
  const now = new Date()
  const result = await orders.updateOne(
    { _id, status: 'pending' },
    { $set: { status: 'cancelled', cancelledAt: now, handledBy: actor, updatedAt: now } },
  )
  return result.modifiedCount === 1
}

/** Records a return: goods go back on the shelf. The money itself is returned outside the system. */
export async function refundOrder(id: string, actor: ActorRef, note: string) {
  const _id = objectId(id)
  if (!_id) return false
  const { orders } = await collections()
  const now = new Date()
  const doc = await orders.findOneAndUpdate(
    { _id, status: 'paid' },
    { $set: { status: 'refunded', refundedAt: now, handledBy: actor, note: note || undefined, updatedAt: now } },
    { returnDocument: 'after' },
  )
  if (!doc) return false
  await moveOrderStock('return', doc.orderNo, doc.items, actor)
  return true
}

/* ─────────────────────────── Listing ─────────────────────────── */

export type OrderRange = 'today' | '7d' | '30d' | 'month' | 'all'
export type OrderListFilter = { status?: OrderStatus; range?: OrderRange; q?: string; page?: number }
export const ORDERS_PAGE_SIZE = 30

export function rangeStart(range: OrderRange | undefined) {
  switch (range) {
    case 'today':
      return startOfDay(0)
    case '7d':
      return startOfDay(6)
    case '30d':
      return startOfDay(29)
    case 'month':
      return startOfMonth(0)
    default:
      return null
  }
}

function orderFilter({ status, range, q }: OrderListFilter): Filter<OrderDoc> {
  const filter: Filter<OrderDoc> = {}
  if (status) filter.status = status
  const from = rangeStart(range)
  if (from) filter.createdAt = { $gte: from }
  if (q) {
    const re = new RegExp(escapeRegex(q), 'i')
    filter.$or = [{ orderNo: re }, { 'items.name': re }, { 'student.studentName': re }, { 'student.className': re }, { 'student.studentCode': re }]
  }
  return filter
}

export async function listOrders(params: OrderListFilter = {}) {
  const { orders } = await collections()
  const filter = orderFilter(params)
  const page = Math.max(1, params.page ?? 1)
  const [docs, total, sums] = await Promise.all([
    orders
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * ORDERS_PAGE_SIZE)
      .limit(ORDERS_PAGE_SIZE)
      .toArray(),
    orders.countDocuments(filter),
    orders
      .aggregate<{ revenue: number; items: number; count: number }>([
        { $match: { ...filter, status: 'paid' } },
        { $group: { _id: null, revenue: { $sum: '$total' }, items: { $sum: '$itemCount' }, count: { $sum: 1 } } },
      ])
      .toArray(),
  ])
  return {
    items: docs.map(toOrder),
    total,
    pages: Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE)),
    paid: sums[0] ?? { revenue: 0, items: 0, count: 0 },
  }
}

/** Every order matching the filter, for the CSV export. */
export async function exportOrders(params: OrderListFilter = {}) {
  const { orders } = await collections()
  return (await orders.find(orderFilter(params)).sort({ createdAt: -1 }).limit(20000).toArray()).map(toOrder)
}

export async function countOrdersByStatus(range?: OrderRange) {
  const { orders } = await collections()
  const from = rangeStart(range)
  const rows = await orders
    .aggregate<{ _id: OrderStatus; count: number }>([...(from ? [{ $match: { createdAt: { $gte: from } } }] : []), { $group: { _id: '$status', count: { $sum: 1 } } }])
    .toArray()
  const counts: Record<OrderStatus, number> = { pending: 0, paid: 0, cancelled: 0, refunded: 0 }
  for (const row of rows) counts[row._id] = row.count
  return counts
}

export async function getOrderById(id: string) {
  const _id = objectId(id)
  if (!_id) return null
  const { orders } = await collections()
  const doc = await orders.findOne({ _id })
  return doc ? toOrder(doc) : null
}

/** Units sold and revenue for one product over the last `days` days. */
export async function productSales(productId: string, days = 30) {
  const _id = objectId(productId)
  if (!_id) return { qty: 0, revenue: 0, bySize: [] as { size: string; qty: number }[] }
  const { orders } = await collections()
  const rows = await orders
    .aggregate<{ _id: string; qty: number; revenue: number }>([
      { $match: { status: 'paid', paidAt: { $gte: startOfDay(days - 1) }, 'items.productId': _id } },
      { $unwind: '$items' },
      { $match: { 'items.productId': _id } },
      { $group: { _id: '$items.size', qty: { $sum: '$items.qty' }, revenue: { $sum: '$items.lineTotal' } } },
      { $sort: { qty: -1 } },
    ])
    .toArray()
  return {
    qty: rows.reduce((sum, row) => sum + row.qty, 0),
    revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
    bySize: rows.map((row) => ({ size: row._id, qty: row.qty })),
  }
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && value in ORDER_STATUS_LABELS
}

export function isOrderRange(value: unknown): value is OrderRange {
  return value === 'today' || value === '7d' || value === '30d' || value === 'month' || value === 'all'
}
