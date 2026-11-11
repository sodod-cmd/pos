import 'server-only'
import { ObjectId, type Filter, type WithId } from 'mongodb'
import { collections, escapeRegex } from '@/lib/db'
import { recordMovements, type ActorRef, type MovementInput } from '@/lib/inventory'
import { DEFAULT_LOW_STOCK_THRESHOLD, type CategoryOption, type Product } from '@/lib/products'
import { stockStatus, type StockStatus } from '@/lib/catalog-status'
import { slugify } from '@/lib/slug'

/* ───────────────────────────── Types ───────────────────────────── */

export type CategoryDoc = {
  name: string
  slug: string
  description: string
  /** Products in this category are sold by size (clothing). */
  hasSizes: boolean
  /** Sizes offered as one-click chips when adding a product, e.g. 116 … 164. */
  sizePresets: string[]
  order: number
  createdAt: Date
  updatedAt: Date
}

export type Category = CategoryDoc & { id: string }
export type CategoryWithCount = Category & { productCount: number; activeCount: number }

export type VariantDoc = { size: string; stock: number }

export type ProductDoc = {
  name: string
  slug: string
  description: string
  categoryId: ObjectId
  price: number
  images: string[]
  variants: VariantDoc[]
  /** A size (or the product) at or below this many units counts as running low. */
  lowStockThreshold: number
  /** Hidden products stay in the admin but are not sold on the POS. */
  active: boolean
  order: number
  /** Bumped on every stock or catalog change; guards read-modify-write saves. */
  version: number
  createdAt: Date
  updatedAt: Date
}


export type AdminProduct = Omit<ProductDoc, 'categoryId'> & {
  id: string
  categoryId: string
  categoryName: string
  hasSizes: boolean
  totalStock: number
  status: StockStatus
  lowVariants: VariantDoc[]
  outVariants: VariantDoc[]
}

export type ProductInput = {
  name: string
  description: string
  categoryId: string
  price: number
  images: string[]
  lowStockThreshold: number
  active: boolean
  /** `orig` is the stock the form was opened with, so a save applies only what the admin changed. */
  variants: { size: string; stock: number; orig: number | null }[]
}

export { stockStatus, type StockStatus }

function objectId(id: string) {
  return ObjectId.isValid(id) ? new ObjectId(id) : null
}

/* ─────────────────────────── Categories ─────────────────────────── */

function toCategory({ _id, ...rest }: WithId<CategoryDoc>): Category {
  return { ...rest, id: _id.toHexString() }
}

export async function listCategories(): Promise<CategoryWithCount[]> {
  const { categories, products } = await collections()
  const [docs, counts] = await Promise.all([
    categories.find().sort({ order: 1, createdAt: 1 }).toArray(),
    products
      .aggregate<{ _id: ObjectId; total: number; active: number }>([
        { $group: { _id: '$categoryId', total: { $sum: 1 }, active: { $sum: { $cond: ['$active', 1, 0] } } } },
      ])
      .toArray(),
  ])
  const byId = new Map(counts.map((c) => [c._id.toHexString(), c]))
  return docs.map((doc) => {
    const category = toCategory(doc)
    const count = byId.get(category.id)
    return { ...category, productCount: count?.total ?? 0, activeCount: count?.active ?? 0 }
  })
}

export async function getCategoryById(id: string) {
  const _id = objectId(id)
  if (!_id) return null
  const { categories } = await collections()
  const doc = await categories.findOne({ _id })
  return doc ? toCategory(doc) : null
}

export async function categoryNameTaken(name: string, exceptId?: string) {
  const { categories } = await collections()
  const except = exceptId ? objectId(exceptId) : null
  const filter: Filter<CategoryDoc> = { name: new RegExp(`^${escapeRegex(name)}$`, 'i') }
  if (except) filter._id = { $ne: except }
  return (await categories.countDocuments(filter)) > 0
}

async function uniqueSlug(collection: 'categories' | 'products', text: string, fallback: string, exceptId?: ObjectId) {
  const c = await collections()
  const target = c[collection] as unknown as import('mongodb').Collection<{ slug: string }>
  const base = slugify(text) || fallback
  for (let n = 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`
    const filter: Filter<{ slug: string }> = { slug }
    if (exceptId) filter._id = { $ne: exceptId }
    if ((await target.countDocuments(filter)) === 0) return slug
  }
}

export type CategoryInput = Pick<CategoryDoc, 'name' | 'description' | 'hasSizes' | 'sizePresets' | 'order'>

export async function createCategory(input: CategoryInput) {
  const { categories } = await collections()
  const now = new Date()
  const slug = await uniqueSlug('categories', input.name, 'category')
  const { insertedId } = await categories.insertOne({ ...input, slug, createdAt: now, updatedAt: now })
  return insertedId.toHexString()
}

export async function updateCategory(id: string, input: CategoryInput) {
  const _id = objectId(id)
  if (!_id) return null
  const { categories } = await collections()
  const doc = await categories.findOneAndUpdate({ _id }, { $set: { ...input, updatedAt: new Date() } }, { returnDocument: 'after' })
  return doc ? toCategory(doc) : null
}

/** Refuses while products still use the category, so nothing ends up uncategorised. */
export async function deleteCategory(id: string): Promise<'deleted' | 'in-use' | 'not-found'> {
  const _id = objectId(id)
  if (!_id) return 'not-found'
  const { categories, products } = await collections()
  if ((await products.countDocuments({ categoryId: _id })) > 0) return 'in-use'
  return (await categories.deleteOne({ _id })).deletedCount === 1 ? 'deleted' : 'not-found'
}

export async function categoryOptions(): Promise<(CategoryOption & { hasSizes: boolean; sizePresets: string[] })[]> {
  const { categories } = await collections()
  const docs = await categories.find().sort({ order: 1, createdAt: 1 }).toArray()
  return docs.map((doc) => ({ id: doc._id.toHexString(), name: doc.name, hasSizes: doc.hasSizes, sizePresets: doc.sizePresets }))
}

/* ──────────────────────────── Products ──────────────────────────── */

async function categoryMap() {
  const { categories } = await collections()
  const docs = await categories.find().toArray()
  return new Map(docs.map((doc) => [doc._id.toHexString(), doc]))
}

function toAdminProduct({ _id, categoryId, ...rest }: WithId<ProductDoc>, cats: Map<string, CategoryDoc>): AdminProduct {
  const category = cats.get(categoryId.toHexString())
  const totalStock = rest.variants.reduce((sum, v) => sum + Math.max(0, v.stock), 0)
  const outVariants = rest.variants.filter((v) => v.stock <= 0)
  const lowVariants = rest.variants.filter((v) => stockStatus(v.stock, rest.lowStockThreshold) === 'low')
  const status: StockStatus = totalStock <= 0 ? 'out' : outVariants.length || lowVariants.length ? 'low' : 'ok'
  return {
    ...rest,
    id: _id.toHexString(),
    categoryId: categoryId.toHexString(),
    categoryName: category?.name ?? 'Ангилалгүй',
    hasSizes: category?.hasSizes ?? rest.variants.some((v) => v.size !== ''),
    totalStock,
    status,
    lowVariants,
    outVariants,
  }
}

export type ProductListFilter = {
  q?: string
  categoryId?: string
  status?: 'active' | 'hidden'
  stock?: 'low' | 'out'
}

export async function listProducts({ q, categoryId, status, stock }: ProductListFilter = {}) {
  const { products } = await collections()
  const filter: Filter<ProductDoc> = {}
  const cat = categoryId ? objectId(categoryId) : null
  if (cat) filter.categoryId = cat
  if (status) filter.active = status === 'active'
  if (q) {
    const re = new RegExp(escapeRegex(q), 'i')
    filter.$or = [{ name: re }, { description: re }, { slug: re }]
  }
  const [docs, cats] = await Promise.all([products.find(filter).sort({ order: 1, createdAt: 1 }).toArray(), categoryMap()])
  let list = docs.map((doc) => toAdminProduct(doc, cats))
  if (stock === 'out') list = list.filter((p) => p.outVariants.length > 0)
  if (stock === 'low') list = list.filter((p) => p.lowVariants.length > 0 || p.outVariants.length > 0)
  // Keep the category order of the POS screen.
  const order = new Map([...cats.entries()].map(([id, c]) => [id, c.order]))
  return list.sort((a, b) => (order.get(a.categoryId) ?? 99) - (order.get(b.categoryId) ?? 99))
}

export async function getProductStats() {
  const { products } = await collections()
  const [total, active] = await Promise.all([products.countDocuments(), products.countDocuments({ active: true })])
  return { total, active, hidden: total - active }
}

export async function getProductById(id: string) {
  const _id = objectId(id)
  if (!_id) return null
  const { products } = await collections()
  const [doc, cats] = await Promise.all([products.findOne({ _id }), categoryMap()])
  return doc ? toAdminProduct(doc, cats) : null
}

/** What the POS screen sells: active products, grouped by category order. */
export async function getPosCatalog(): Promise<{ categories: CategoryOption[]; products: Product[] }> {
  const { products } = await collections()
  const [docs, cats] = await Promise.all([products.find({ active: true }).sort({ order: 1, createdAt: 1 }).toArray(), categoryMap()])
  const sorted = docs
    .map((doc) => toAdminProduct(doc, cats))
    .sort((a, b) => (cats.get(a.categoryId)?.order ?? 99) - (cats.get(b.categoryId)?.order ?? 99))

  const usedCategories = [...new Set(sorted.map((p) => p.categoryId))]
  return {
    categories: usedCategories.map((id) => ({ id, name: cats.get(id)?.name ?? 'Бусад' })),
    products: sorted.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      categoryId: p.categoryId,
      categoryName: p.categoryName,
      price: p.price,
      images: p.images,
      hasSizes: p.hasSizes,
      variants: p.variants.map(({ size, stock }) => ({ size, stock })),
      lowStockThreshold: p.lowStockThreshold,
    })),
  }
}

export async function createProduct(input: ProductInput, actor: ActorRef) {
  const { products } = await collections()
  const categoryId = objectId(input.categoryId)
  if (!categoryId) throw new Error('Invalid category')
  const now = new Date()
  const slug = await uniqueSlug('products', input.name, 'product')
  const variants = input.variants.map(({ size, stock }) => ({ size, stock }))
  const last = await products.find().sort({ order: -1 }).limit(1).next()
  const { insertedId } = await products.insertOne({
    name: input.name,
    slug,
    description: input.description,
    categoryId,
    price: input.price,
    images: input.images,
    variants,
    lowStockThreshold: input.lowStockThreshold,
    active: input.active,
    order: (last?.order ?? 0) + 1,
    version: 0,
    createdAt: now,
    updatedAt: now,
  })
  await recordMovements(
    variants
      .filter((v) => v.stock !== 0)
      .map((v) => ({
        productId: insertedId,
        productName: input.name,
        size: v.size,
        type: 'initial',
        delta: v.stock,
        balanceAfter: v.stock,
        note: 'Бараа бүртгэх үеийн эхний үлдэгдэл',
        actor,
      })),
  )
  return insertedId.toHexString()
}

/**
 * Saves the product form. Stock is applied as a change against what the form was opened with,
 * so a sale made while the form was open is not overwritten. Retries when another write lands
 * between the read and the save.
 */
export async function updateProduct(id: string, input: ProductInput, actor: ActorRef): Promise<'saved' | 'not-found' | 'conflict'> {
  const _id = objectId(id)
  const categoryId = objectId(input.categoryId)
  if (!_id || !categoryId) return 'not-found'
  const { products } = await collections()

  for (let attempt = 0; attempt < 4; attempt++) {
    const doc = await products.findOne({ _id })
    if (!doc) return 'not-found'

    const movements: MovementInput[] = []
    const variants = input.variants.map(({ size, stock, orig }) => {
      const current = doc.variants.find((v) => v.size === size)
      const next = current && orig !== null ? current.stock + (stock - orig) : stock
      const delta = next - (current?.stock ?? 0)
      if (delta !== 0) {
        movements.push({
          productId: _id,
          productName: input.name,
          size,
          type: current ? 'adjust' : 'initial',
          delta,
          balanceAfter: next,
          note: current ? 'Барааны мэдээлэл засах үед' : 'Шинэ хэмжээ нэмсэн',
          actor,
        })
      }
      return { size, stock: next }
    })
    for (const removed of doc.variants.filter((old) => !variants.some((n) => n.size === old.size))) {
      if (removed.stock !== 0) {
        movements.push({
          productId: _id,
          productName: input.name,
          size: removed.size,
          type: 'adjust',
          delta: -removed.stock,
          balanceAfter: 0,
          note: 'Хэмжээг бараанаас хассан',
          actor,
        })
      }
    }

    const result = await products.updateOne(
      { _id, version: doc.version },
      {
        $set: {
          name: input.name,
          description: input.description,
          categoryId,
          price: input.price,
          images: input.images,
          variants,
          lowStockThreshold: input.lowStockThreshold,
          active: input.active,
          updatedAt: new Date(),
        },
        $inc: { version: 1 },
      },
    )
    if (result.matchedCount === 1) {
      await recordMovements(movements)
      return 'saved'
    }
  }
  return 'conflict'
}

export async function setProductActive(id: string, active: boolean) {
  const _id = objectId(id)
  if (!_id) return
  const { products } = await collections()
  await products.updateOne({ _id }, { $set: { active, updatedAt: new Date() }, $inc: { version: 1 } })
}

/** Orders keep their own copy of name and price, so deleting a product does not change sales history. */
export async function deleteProduct(id: string) {
  const _id = objectId(id)
  if (!_id) return null
  const { products } = await collections()
  return products.findOneAndDelete({ _id })
}

export { DEFAULT_LOW_STOCK_THRESHOLD }
