import 'server-only'
import { MongoClient, type Db } from 'mongodb'
import type { AdminDoc } from '@/lib/admin-users'
import type { CategoryDoc, ProductDoc } from '@/lib/catalog'
import type { StockMovementDoc } from '@/lib/inventory'
import type { OrderDoc } from '@/lib/orders'

const globalForMongo = globalThis as unknown as { _mongoClient?: Promise<MongoClient>; _mongoIndexes?: Promise<unknown> }

// Reuse one client across hot reloads in dev and across requests in production.
function client() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not set')
  globalForMongo._mongoClient ??= new MongoClient(uri).connect().catch((error) => {
    // Let the next request try again instead of caching a failed connection forever.
    globalForMongo._mongoClient = undefined
    throw error
  })
  return globalForMongo._mongoClient
}

export async function getDb(): Promise<Db> {
  const db = (await client()).db(process.env.MONGODB_DB_NAME || 'pointofsale')
  globalForMongo._mongoIndexes ??= Promise.all([
    db.collection('admins').createIndex({ email: 1 }, { unique: true }),
    db.collection('categories').createIndex({ slug: 1 }, { unique: true }),
    db.collection('categories').createIndex({ order: 1, createdAt: 1 }),
    db.collection('products').createIndex({ slug: 1 }, { unique: true }),
    db.collection('products').createIndex({ categoryId: 1, active: 1, order: 1 }),
    db.collection('orders').createIndex({ orderNo: 1 }, { unique: true }),
    db.collection('orders').createIndex({ invoiceId: 1 }, { sparse: true }),
    db.collection('orders').createIndex({ status: 1, createdAt: -1 }),
    db.collection('orders').createIndex({ status: 1, paidAt: -1 }),
    db.collection('stock_movements').createIndex({ createdAt: -1 }),
    db.collection('stock_movements').createIndex({ productId: 1, createdAt: -1 }),
  ]).catch((error) => {
    globalForMongo._mongoIndexes = undefined
    console.error('[db] Failed to create indexes', error)
  })
  await globalForMongo._mongoIndexes
  return db
}

export async function collections() {
  const db = await getDb()
  return {
    admins: db.collection<AdminDoc>('admins'),
    categories: db.collection<CategoryDoc>('categories'),
    products: db.collection<ProductDoc>('products'),
    orders: db.collection<OrderDoc>('orders'),
    movements: db.collection<StockMovementDoc>('stock_movements'),
  }
}

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
