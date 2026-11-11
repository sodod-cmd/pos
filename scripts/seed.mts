/**
 * Seeds the first admin, the product categories (Хувцас, Ном, Дэвтэр) and the products the POS
 * showed before it moved to MongoDB, each with its opening stock.
 *
 * Safe to re-run: admins (matched by email), categories and products (matched by slug) that
 * already exist are left untouched, so stock and edits made in the admin are never overwritten.
 *
 *   npm run seed                # everything
 *   npm run seed -- admin       # only one part: admin | categories | products
 */
import bcrypt from 'bcryptjs'
import { MongoClient, type ObjectId } from 'mongodb'
import { SEED_CATEGORIES, SEED_PRODUCTS } from './seed-data.mts'

const SEED_ADMIN = {
  name: process.env.SEED_ADMIN_NAME || 'Сургалтын алба',
  email: (process.env.SEED_ADMIN_EMAIL || 'admin@school.mn').trim().toLowerCase(),
  password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123',
}

const TARGETS = ['admin', 'categories', 'products'] as const
type Target = (typeof TARGETS)[number]

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error('MONGODB_URI is not set (.env)')
  process.exit(1)
}
const dbName = process.env.MONGODB_DB_NAME || 'pointofsale'

const requested = process.argv.slice(2)
for (const name of requested) {
  if (!TARGETS.includes(name as Target)) {
    console.error(`Unknown seed target "${name}". Use one of: ${TARGETS.join(', ')}`)
    process.exit(1)
  }
}
const run = (target: Target) => requested.length === 0 || requested.includes(target)

const client = new MongoClient(uri)

async function main() {
  try {
    await client.connect()
    const db = client.db(dbName)
    console.log(`Seeding database "${dbName}"…\n`)
    const now = new Date()

    if (run('admin')) {
      const admins = db.collection('admins')
      await admins.createIndex({ email: 1 }, { unique: true })
      if (await admins.findOne({ email: SEED_ADMIN.email })) {
        console.log(`= admin ${SEED_ADMIN.email} (already exists)`)
      } else {
        await admins.insertOne({
          name: SEED_ADMIN.name,
          email: SEED_ADMIN.email,
          passwordHash: await bcrypt.hash(SEED_ADMIN.password, 12),
          tokenVersion: 0,
          mustChangePassword: true,
          createdAt: now,
          updatedAt: now,
        })
        console.log(`+ admin ${SEED_ADMIN.email}`)
      }
    }

    const categories = db.collection('categories')
    if (run('categories') || run('products')) {
      await categories.createIndex({ slug: 1 }, { unique: true })
      for (const category of SEED_CATEGORIES) {
        if (await categories.findOne({ slug: category.slug })) {
          if (run('categories')) console.log(`= category ${category.name} (already exists)`)
          continue
        }
        await categories.insertOne({ ...category, createdAt: now, updatedAt: now })
        console.log(`+ category ${category.name}`)
      }
    }

    if (run('products')) {
      const products = db.collection('products')
      const movements = db.collection('stock_movements')
      await products.createIndex({ slug: 1 }, { unique: true })
      const categoryIds = new Map<string, ObjectId>()
      for (const doc of await categories.find({}, { projection: { slug: 1 } }).toArray()) categoryIds.set(doc.slug as string, doc._id)

      let order = 0
      for (const product of SEED_PRODUCTS) {
        order++
        if (await products.findOne({ slug: product.slug })) {
          console.log(`= product ${product.name} (already exists)`)
          continue
        }
        const categoryId = categoryIds.get(product.category)
        if (!categoryId) {
          console.warn(`! product ${product.name}: category "${product.category}" not found, skipped`)
          continue
        }
        const variants = (product.sizes ?? ['']).map((size) => ({ size, stock: product.stock }))
        const { insertedId } = await products.insertOne({
          name: product.name,
          slug: product.slug,
          description: product.description,
          categoryId,
          price: product.price,
          images: product.images,
          variants,
          lowStockThreshold: product.lowStockThreshold,
          active: true,
          order,
          version: 0,
          createdAt: now,
          updatedAt: now,
        })
        await movements.insertMany(
          variants.map((variant) => ({
            productId: insertedId,
            productName: product.name,
            size: variant.size,
            type: 'initial',
            delta: variant.stock,
            balanceAfter: variant.stock,
            note: 'Анхны өгөгдөл (seed)',
            actor: null,
            createdAt: now,
          })),
        )
        const units = variants.reduce((sum, v) => sum + v.stock, 0)
        console.log(`+ product ${product.name} (${variants.length > 1 ? `${variants.length} хэмжээ, ` : ''}${units} ш)`)
      }
    }

    console.log('\nDone.')
    if (run('admin')) {
      console.log(`\nАдмин руу нэвтрэх: /admin/login\n  Имэйл:   ${SEED_ADMIN.email}\n  Нууц үг: ${process.env.SEED_ADMIN_PASSWORD ? '(SEED_ADMIN_PASSWORD)' : SEED_ADMIN.password}\nНэвтэрсэн даруйдаа нууц үгээ солино уу.`)
    }
  } catch (error) {
    console.error('\nSeed failed:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  } finally {
    await client.close()
  }
}

void main()
