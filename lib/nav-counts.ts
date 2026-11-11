import 'server-only'
import { collections } from '@/lib/db'
import { PENDING_STALE_MS } from '@/lib/orders'

/** Small numbers for the sidebar badges: sizes that need restocking and invoices awaiting payment. */
export async function getNavCounts() {
  try {
    const { products, orders } = await collections()
    const [stock] = await products
      .aggregate<{ count: number }>([
        { $match: { active: true } },
        { $unwind: '$variants' },
        { $match: { $expr: { $lte: ['$variants.stock', '$lowStockThreshold'] } } },
        { $count: 'count' },
      ])
      .toArray()
    const pendingOrders = await orders.countDocuments({ status: 'pending', createdAt: { $gte: new Date(Date.now() - PENDING_STALE_MS) } })
    return { stockAlerts: stock?.count ?? 0, pendingOrders }
  } catch (error) {
    console.error('[nav] Counts failed', error)
    return { stockAlerts: 0, pendingOrders: 0 }
  }
}
