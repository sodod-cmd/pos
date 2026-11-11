import 'server-only'
import { adminsWithSeedPassword } from '@/lib/admin-users'
import { stockStatus } from '@/lib/catalog'
import { collections } from '@/lib/db'
import { PENDING_STALE_MS, type OrderDoc } from '@/lib/orders'
import { formatStudent } from '@/lib/pos-types'
import { isQpayConfigured } from '@/lib/qpay'
import { isS3Configured } from '@/lib/s3'
import { DAY_MS, TIME_ZONE, dayKey, startOfDay, startOfMonth } from '@/lib/time'
import type { Filter } from 'mongodb'

const SERIES_DAYS = 14
const TOP_DAYS = 30

export type SalesTotals = { revenue: number; orders: number; items: number }
export type DayPoint = { day: string; date: Date; revenue: number; orders: number }
export type StockAlert = {
  productId: string
  productName: string
  categoryName: string
  image?: string
  size: string
  stock: number
  threshold: number
  price: number
}

async function totals(filter: Filter<OrderDoc>): Promise<SalesTotals> {
  const { orders } = await collections()
  const [row] = await orders
    .aggregate<SalesTotals>([
      { $match: { status: 'paid', ...filter } },
      { $group: { _id: null, revenue: { $sum: '$total' }, orders: { $sum: 1 }, items: { $sum: '$itemCount' } } },
      { $project: { _id: 0, revenue: 1, orders: 1, items: 1 } },
    ])
    .toArray()
  return row ?? { revenue: 0, orders: 0, items: 0 }
}

/** Everything the dashboard shows, read in parallel. */
export async function getDashboard() {
  const c = await collections()
  const now = new Date()
  const today = startOfDay(0)
  const yesterday = startOfDay(1)
  const monthStart = startOfMonth(0)
  const lastMonthStart = startOfMonth(1)
  // The same number of days into last month, so a month-to-date comparison is fair.
  const lastMonthSameDay = new Date(Math.min(lastMonthStart.getTime() + (now.getTime() - monthStart.getTime()), monthStart.getTime()))
  const seriesStart = startOfDay(SERIES_DAYS - 1)
  const topStart = startOfDay(TOP_DAYS - 1)

  const [
    todayTotals,
    yesterdayTotals,
    monthTotals,
    lastMonthTotals,
    dailyRows,
    topProducts,
    byCategory,
    topSizes,
    products,
    categories,
    stalePending,
    recentOrders,
    seedAdmins,
  ] = await Promise.all([
    totals({ paidAt: { $gte: today } }),
    totals({ paidAt: { $gte: yesterday, $lt: today } }),
    totals({ paidAt: { $gte: monthStart } }),
    totals({ paidAt: { $gte: lastMonthStart, $lt: lastMonthSameDay } }),
    c.orders
      .aggregate<{ _id: string; revenue: number; orders: number }>([
        { $match: { status: 'paid', paidAt: { $gte: seriesStart } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: TIME_ZONE } }, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
      ])
      .toArray(),
    c.orders
      .aggregate<{ _id: string; name: string; image?: string; qty: number; revenue: number }>([
        { $match: { status: 'paid', paidAt: { $gte: topStart } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: { $toString: '$items.productId' },
            name: { $last: '$items.name' },
            image: { $last: '$items.image' },
            qty: { $sum: '$items.qty' },
            revenue: { $sum: '$items.lineTotal' },
          },
        },
        { $sort: { qty: -1, revenue: -1 } },
        { $limit: 6 },
      ])
      .toArray(),
    c.orders
      .aggregate<{ _id: string; qty: number; revenue: number }>([
        { $match: { status: 'paid', paidAt: { $gte: monthStart } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.categoryName', qty: { $sum: '$items.qty' }, revenue: { $sum: '$items.lineTotal' } } },
        { $sort: { revenue: -1 } },
      ])
      .toArray(),
    c.orders
      .aggregate<{ _id: string; qty: number }>([
        { $match: { status: 'paid', paidAt: { $gte: topStart } } },
        { $unwind: '$items' },
        { $match: { 'items.size': { $ne: '' } } },
        { $group: { _id: '$items.size', qty: { $sum: '$items.qty' } } },
        { $sort: { qty: -1 } },
        { $limit: 8 },
      ])
      .toArray(),
    c.products.find({}, { projection: { name: 1, categoryId: 1, price: 1, images: 1, variants: 1, lowStockThreshold: 1, active: 1 } }).toArray(),
    c.categories.find({}, { projection: { name: 1 } }).toArray(),
    c.orders.countDocuments({ status: 'pending', createdAt: { $lt: new Date(now.getTime() - PENDING_STALE_MS) } }),
    c.orders.find().sort({ createdAt: -1 }).limit(8).toArray(),
    adminsWithSeedPassword(),
  ])

  // Fill the days without sales so the chart has one bar per day.
  const byDay = new Map(dailyRows.map((row) => [row._id, row]))
  const series: DayPoint[] = Array.from({ length: SERIES_DAYS }, (_, i) => {
    const date = new Date(seriesStart.getTime() + i * DAY_MS)
    const key = dayKey(date)
    return { day: key, date, revenue: byDay.get(key)?.revenue ?? 0, orders: byDay.get(key)?.orders ?? 0 }
  })

  const categoryName = new Map(categories.map((cat) => [cat._id.toHexString(), cat.name]))
  const low: StockAlert[] = []
  const out: StockAlert[] = []
  let units = 0
  let value = 0
  let variants = 0
  for (const product of products) {
    for (const variant of product.variants) {
      variants++
      units += Math.max(0, variant.stock)
      value += Math.max(0, variant.stock) * product.price
      if (!product.active) continue
      const alert: StockAlert = {
        productId: product._id.toHexString(),
        productName: product.name,
        categoryName: categoryName.get(product.categoryId.toHexString()) ?? '',
        image: product.images[0],
        size: variant.size,
        stock: variant.stock,
        threshold: product.lowStockThreshold,
        price: product.price,
      }
      const status = stockStatus(variant.stock, product.lowStockThreshold)
      if (status === 'out') out.push(alert)
      else if (status === 'low') low.push(alert)
    }
  }
  low.sort((a, b) => a.stock - b.stock || a.productName.localeCompare(b.productName))
  out.sort((a, b) => a.stock - b.stock || a.productName.localeCompare(b.productName))

  return {
    today: todayTotals,
    yesterday: yesterdayTotals,
    month: monthTotals,
    lastMonth: lastMonthTotals,
    series,
    topProducts: topProducts.map(({ _id, ...rest }) => ({ productId: _id, ...rest })),
    byCategory: byCategory.map(({ _id, ...rest }) => ({ name: _id || 'Бусад', ...rest })),
    topSizes: topSizes.map(({ _id, qty }) => ({ size: _id, qty })),
    inventory: { units, value, variants, products: products.length, active: products.filter((p) => p.active).length },
    lowStock: low,
    outOfStock: out,
    stalePending,
    recentOrders: recentOrders.map((o) => ({
      id: o._id.toHexString(),
      orderNo: o.orderNo,
      status: o.status,
      total: o.total,
      itemCount: o.itemCount,
      demo: o.demo,
      createdAt: o.createdAt,
      summary: [formatStudent(o.student), o.items.map((item) => `${item.name}${item.size ? ` (${item.size})` : ''} ×${item.qty}`).join(', ')].filter(Boolean).join(' — '),
    })),
    seedAdmins,
    qpayConfigured: isQpayConfigured(),
    s3Configured: isS3Configured(),
  }
}
