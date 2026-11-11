'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { readField, type AdminFormState } from '@/lib/admin-form'
import { requireAdmin } from '@/lib/auth/session'
import {
  createProduct,
  deleteProduct,
  getCategoryById,
  getProductById,
  setProductActive,
  updateProduct,
  type ProductInput,
} from '@/lib/catalog'
import { applyStockChanges, type StockMode } from '@/lib/inventory'
import { IMAGE_TYPES, MAX_IMAGE_BYTES, deleteUploadedImage, uploadImage } from '@/lib/s3'

const MAX_IMAGES = 6
const MAX_PRICE = 10_000_000
const MAX_STOCK = 99_999

function revalidateCatalog(id?: string) {
  revalidatePath('/')
  revalidatePath('/admin', 'layout')
  if (id) revalidatePath(`/admin/products/${id}`)
}

function parseJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

function toInt(text: string) {
  const cleaned = text.replace(/[\s,₮]/g, '')
  return /^-?\d+$/.test(cleaned) ? Number(cleaned) : Number.NaN
}

type RawVariant = { size?: unknown; stock?: unknown; orig?: unknown }

export async function saveProduct(id: string | null, _prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin()
  const actor = { id: admin.id, name: admin.name }
  const existing = id ? await getProductById(id) : null
  if (id && !existing) return { status: 'error', message: 'Бараа олдсонгүй. Өөр админ устгасан байж магадгүй.' }

  const values = {
    name: readField(formData, 'name', 120),
    description: readField(formData, 'description', 600),
    categoryId: readField(formData, 'categoryId', 40),
    price: readField(formData, 'price', 20),
    lowStockThreshold: readField(formData, 'lowStockThreshold', 6),
    active: formData.get('active') === 'on' ? 'on' : '',
    variants: readField(formData, 'variants', 20000),
    imageOrder: readField(formData, 'imageOrder', 20000),
  }
  const price = toInt(values.price)
  const threshold = values.lowStockThreshold === '' ? 0 : toInt(values.lowStockThreshold)
  const category = values.categoryId ? await getCategoryById(values.categoryId) : null

  const errors: Record<string, string> = {}
  if (values.name.length < 2) errors.name = 'Барааны нэрийг оруулна уу.'
  if (!category) errors.categoryId = 'Ангилал сонгоно уу.'
  if (!Number.isInteger(price) || price <= 0) errors.price = 'Үнийг төгрөгөөр, бүхэл тоогоор оруулна уу.'
  else if (price > MAX_PRICE) errors.price = 'Үнэ хэт өндөр байна.'
  if (!Number.isInteger(threshold) || threshold < 0 || threshold > 9999) errors.lowStockThreshold = '0-9999 хооронд бүхэл тоо оруулна уу.'

  // Sizes and their stock, edited as a list in the form.
  const raw = parseJson<RawVariant[]>(values.variants, [])
  const variants: ProductInput['variants'] = []
  if (!Array.isArray(raw)) errors.variants = 'Хэмжээний мэдээлэл буруу байна.'
  else {
    for (const item of raw) {
      const size = typeof item.size === 'string' ? item.size.trim().slice(0, 12) : ''
      const stock = typeof item.stock === 'number' ? item.stock : toInt(String(item.stock ?? ''))
      const orig = typeof item.orig === 'number' && Number.isInteger(item.orig) ? item.orig : null
      if (!Number.isInteger(stock) || stock < 0 || stock > MAX_STOCK) {
        errors.variants = `${size ? `${size} хэмжээний ` : ''}үлдэгдэл 0-${MAX_STOCK} хооронд бүхэл тоо байна.`
        break
      }
      variants.push({ size, stock, orig })
    }
  }
  if (!errors.variants && category) {
    if (category.hasSizes) {
      const sizes = variants.map((v) => v.size)
      if (variants.length === 0) errors.variants = 'Дор хаяж нэг хэмжээ нэмнэ үү.'
      else if (sizes.some((s) => !s)) errors.variants = 'Хэмжээний нэрийг хоосон орхиж болохгүй.'
      else if (new Set(sizes).size !== sizes.length) errors.variants = 'Ижил хэмжээ давхардсан байна.'
      else if (variants.length > 40) errors.variants = 'Хэт олон хэмжээ байна.'
    } else {
      // One stock line for products not sold by size.
      const single = variants.find((v) => v.size === '') ?? variants[0]
      variants.splice(0, variants.length, { size: '', stock: single?.stock ?? 0, orig: single && single.size === '' ? single.orig : null })
    }
  }

  // Images: "url:<existing url>" keeps an uploaded image, "file:<n>" is the n-th new file, in display order.
  const order = parseJson<string[]>(values.imageOrder, [])
  const files = formData.getAll('images').filter((f): f is File => f instanceof File && f.size > 0)
  const existingImages = new Set(existing?.images ?? [])
  const tokens = Array.isArray(order) ? order.filter((t) => typeof t === 'string') : []
  if (tokens.length > MAX_IMAGES) errors.images = `Дээд тал нь ${MAX_IMAGES} зураг оруулна.`
  else if (tokens.some((t) => t.startsWith('url:') && !existingImages.has(t.slice(4)))) errors.images = 'Зургийн мэдээлэл буруу байна. Хуудсаа дахин ачаална уу.'
  else if (files.some((f) => !IMAGE_TYPES[f.type])) errors.images = 'JPG, PNG, WebP эсвэл AVIF зураг сонгоно уу.'
  else if (files.some((f) => f.size > MAX_IMAGE_BYTES)) errors.images = 'Зураг бүр 8MB-аас ихгүй байна.'

  if (Object.keys(errors).length) return { status: 'invalid', errors, values, attempt: Date.now() }

  const uploaded = new Map<number, string>()
  try {
    for (const token of tokens) {
      if (!token.startsWith('file:')) continue
      const index = Number(token.slice(5))
      const file = files[index]
      if (file && !uploaded.has(index)) uploaded.set(index, await uploadImage(file, 'products'))
    }
  } catch (error) {
    console.error('[admin-products] Image upload failed', error)
    await Promise.all([...uploaded.values()].map(deleteUploadedImage))
    return { status: 'error', message: 'Зураг байршуулж чадсангүй. S3 тохиргоог шалгаад дахин оролдоно уу.', values, attempt: Date.now() }
  }
  const images = tokens
    .map((token) => (token.startsWith('url:') ? token.slice(4) : uploaded.get(Number(token.slice(5)))))
    .filter((src): src is string => Boolean(src))

  const input: ProductInput = {
    name: values.name,
    description: values.description,
    categoryId: values.categoryId,
    price,
    images,
    lowStockThreshold: threshold,
    active: values.active === 'on',
    variants,
  }

  let savedId = id
  try {
    if (id) {
      const result = await updateProduct(id, input, actor)
      if (result !== 'saved') {
        await Promise.all([...uploaded.values()].map(deleteUploadedImage))
        return {
          status: 'error',
          message: result === 'conflict' ? 'Энэ хооронд барааны үлдэгдэл өөрчлөгдсөн байна. Дахин хадгална уу.' : 'Бараа олдсонгүй.',
          values,
          attempt: Date.now(),
        }
      }
    } else {
      savedId = await createProduct(input, actor)
    }
  } catch (error) {
    console.error('[admin-products] Save failed', error)
    await Promise.all([...uploaded.values()].map(deleteUploadedImage))
    return { status: 'error', message: 'Хадгалах үед алдаа гарлаа. Дахин оролдоно уу.', values, attempt: Date.now() }
  }

  // Images the admin removed from the product.
  if (existing) await Promise.all(existing.images.filter((src) => !images.includes(src)).map(deleteUploadedImage))

  revalidateCatalog(savedId ?? undefined)
  redirect(`/admin/products/${savedId}?flash=${id ? 'updated' : 'created'}`)
}

export async function toggleProductActive(id: string) {
  await requireAdmin()
  const product = await getProductById(id)
  if (!product) return
  await setProductActive(id, !product.active)
  revalidateCatalog(id)
}

export async function removeProduct(id: string) {
  await requireAdmin()
  const product = await deleteProduct(id)
  if (product) {
    await Promise.all(product.images.map(deleteUploadedImage))
    revalidateCatalog()
  }
  redirect('/admin/products?flash=deleted')
}

/** The quick stock form on a product page: one size, one change. */
export async function quickStock(productId: string, _prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin()
  const mode = readField(formData, 'mode', 10) as StockMode
  const size = readField(formData, 'size', 12)
  const qty = toInt(readField(formData, 'qty', 8))
  const note = readField(formData, 'note', 200)
  const values = { mode, size, note }

  const errors: Record<string, string> = {}
  if (!['restock', 'writeoff', 'count'].includes(mode)) errors.mode = 'Үйлдэл сонгоно уу.'
  if (!Number.isInteger(qty) || qty < 0 || qty > MAX_STOCK) errors.qty = 'Тоо ширхэгийг бүхэл тоогоор оруулна уу.'
  else if (mode !== 'count' && qty === 0) errors.qty = '0-ээс их тоо оруулна уу.'
  if (Object.keys(errors).length) return { status: 'invalid', errors, values, attempt: Date.now() }

  const [result] = await applyStockChanges(mode, [{ productId, size, qty }], { note, actor: { id: admin.id, name: admin.name } })
  if (result && !result.ok) return { status: 'error', message: result.reason, values, attempt: Date.now() }

  revalidateCatalog(productId)
  const sizeText = size ? `${size} хэмжээ: ` : ''
  return {
    status: 'success',
    message: result ? `${sizeText}${result.delta > 0 ? '+' : ''}${result.delta} → одоо ${result.balance} ширхэг` : `${sizeText}өөрчлөлт алга.`,
    attempt: Date.now(),
  }
}
