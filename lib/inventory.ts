import 'server-only'
import { ObjectId, type Filter } from 'mongodb'
import { collections } from '@/lib/db'

/* ───────────────────────────── Types ───────────────────────────── */

export type MovementType = 'initial' | 'restock' | 'sale' | 'return' | 'adjust' | 'writeoff'

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  initial: 'Эхний үлдэгдэл',
  restock: 'Орлого',
  sale: 'Борлуулалт',
  return: 'Буцаалт',
  adjust: 'Тооллого / засвар',
  writeoff: 'Хорогдол',
}

export type ActorRef = { id: string; name: string } | null

export type StockMovementDoc = {
  productId: ObjectId
  /** Copied so the log still reads well after a product is renamed or deleted. */
  productName: string
  size: string
  type: MovementType
  /** Positive when stock came in, negative when it went out. */
  delta: number
  balanceAfter: number
  note?: string
  orderNo?: string
  actor: ActorRef
  createdAt: Date
}

export type MovementInput = Omit<StockMovementDoc, 'createdAt'>

export type StockMovement = Omit<StockMovementDoc, 'productId'> & { id: string; productId: string }

/** How a bulk sheet changes one size: receive goods, write some off, or set the counted amount. */
export type StockMode = 'restock' | 'writeoff' | 'count'

export type StockChange = { productId: string; size: string; qty: number }

export type StockChangeResult =
  | { ok: true; productName: string; size: string; delta: number; balance: number }
  | { ok: false; productName: string; size: string; reason: string }

/* ─────────────────────────── Movements ─────────────────────────── */

export async function recordMovements(movements: MovementInput[]) {
  if (movements.length === 0) return
  const { movements: log } = await collections()
  const now = new Date()
  await log.insertMany(movements.map((m) => ({ ...m, createdAt: now })))
}

/**
 * Applies a sheet of stock changes, one atomic update per size. Write-offs never take a size
 * below zero; counts set the stock to what was counted and log the difference.
 */
export async function applyStockChanges(
  mode: StockMode,
  changes: StockChange[],
  meta: { note?: string; actor: ActorRef },
): Promise<StockChangeResult[]> {
  const { products } = await collections()
  const results: StockChangeResult[] = []
  const movements: MovementInput[] = []
  const now = new Date()

  for (const change of changes) {
    const _id = ObjectId.isValid(change.productId) ? new ObjectId(change.productId) : null
    if (!_id || !Number.isInteger(change.qty) || change.qty < 0) {
      results.push({ ok: false, productName: '—', size: change.size, reason: 'Буруу утга' })
      continue
    }
    if (mode !== 'count' && change.qty === 0) continue

    if (mode === 'count') {
      const before = await products.findOneAndUpdate(
        { _id, 'variants.size': change.size },
        { $set: { 'variants.$.stock': change.qty, updatedAt: now }, $inc: { version: 1 } },
        { returnDocument: 'before', projection: { name: 1, variants: 1 } },
      )
      if (!before) {
        results.push({ ok: false, productName: '—', size: change.size, reason: 'Бараа эсвэл хэмжээ олдсонгүй' })
        continue
      }
      const previous = before.variants.find((v) => v.size === change.size)?.stock ?? 0
      const delta = change.qty - previous
      if (delta === 0) continue
      movements.push({ productId: _id, productName: before.name, size: change.size, type: 'adjust', delta, balanceAfter: change.qty, note: meta.note, actor: meta.actor })
      results.push({ ok: true, productName: before.name, size: change.size, delta, balance: change.qty })
      continue
    }

    const delta = mode === 'restock' ? change.qty : -change.qty
    const filter: Filter<import('@/lib/catalog').ProductDoc> =
      mode === 'writeoff'
        ? { _id, variants: { $elemMatch: { size: change.size, stock: { $gte: change.qty } } } }
        : { _id, 'variants.size': change.size }
    const after = await products.findOneAndUpdate(
      filter,
      { $inc: { 'variants.$.stock': delta, version: 1 }, $set: { updatedAt: now } },
      { returnDocument: 'after', projection: { name: 1, variants: 1 } },
    )
    if (!after) {
      const doc = await products.findOne({ _id }, { projection: { name: 1 } })
      results.push({
        ok: false,
        productName: doc?.name ?? '—',
        size: change.size,
        reason: doc ? 'Үлдэгдэл хүрэлцэхгүй байна' : 'Бараа олдсонгүй',
      })
      continue
    }
    const balance = after.variants.find((v) => v.size === change.size)?.stock ?? 0
    movements.push({ productId: _id, productName: after.name, size: change.size, type: mode, delta, balanceAfter: balance, note: meta.note, actor: meta.actor })
    results.push({ ok: true, productName: after.name, size: change.size, delta, balance })
  }

  await recordMovements(movements)
  return results
}

/**
 * Takes sold goods out of stock (or puts returned goods back). Money has already changed hands,
 * so a sale is recorded even if it takes a size below zero; the dashboard flags that for a recount.
 */
export async function moveOrderStock(
  type: 'sale' | 'return',
  orderNo: string,
  items: { productId: ObjectId; name: string; size: string; qty: number }[],
  actor: ActorRef,
) {
  const { products } = await collections()
  const movements: MovementInput[] = []
  const now = new Date()
  for (const item of items) {
    const delta = type === 'sale' ? -item.qty : item.qty
    const after = await products.findOneAndUpdate(
      { _id: item.productId, 'variants.size': item.size },
      { $inc: { 'variants.$.stock': delta, version: 1 }, $set: { updatedAt: now } },
      { returnDocument: 'after', projection: { name: 1, variants: 1 } },
    )
    if (!after) {
      console.warn(`[inventory] ${orderNo}: ${item.name} (${item.size || '—'}) is no longer in the catalog`)
      continue
    }
    movements.push({
      productId: item.productId,
      productName: after.name,
      size: item.size,
      type,
      delta,
      balanceAfter: after.variants.find((v) => v.size === item.size)?.stock ?? 0,
      orderNo,
      actor,
    })
  }
  await recordMovements(movements)
}

export type MovementFilter = { productId?: string; type?: MovementType; page?: number }
export const MOVEMENTS_PAGE_SIZE = 50

export async function listMovements({ productId, type, page = 1 }: MovementFilter = {}) {
  const { movements } = await collections()
  const filter: Filter<StockMovementDoc> = {}
  if (productId && ObjectId.isValid(productId)) filter.productId = new ObjectId(productId)
  if (type) filter.type = type
  const [docs, total] = await Promise.all([
    movements
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * MOVEMENTS_PAGE_SIZE)
      .limit(MOVEMENTS_PAGE_SIZE)
      .toArray(),
    movements.countDocuments(filter),
  ])
  return {
    total,
    pages: Math.max(1, Math.ceil(total / MOVEMENTS_PAGE_SIZE)),
    items: docs.map(({ _id, productId: pid, ...rest }): StockMovement => ({ ...rest, id: _id.toHexString(), productId: pid.toHexString() })),
  }
}

export function isMovementType(value: unknown): value is MovementType {
  return typeof value === 'string' && value in MOVEMENT_LABELS
}
