// Client-safe catalog types and helpers, shared by the POS screen, the API routes and the admin.

export interface ProductVariant {
  /** '' for products that are not sold by size (books, notebooks). */
  size: string
  stock: number
}

export interface Product {
  id: string
  slug: string
  name: string
  description: string
  categoryId: string
  categoryName: string
  price: number
  images: string[]
  hasSizes: boolean
  variants: ProductVariant[]
  lowStockThreshold: number
}

export interface CategoryOption {
  id: string
  name: string
}

export const DEFAULT_LOW_STOCK_THRESHOLD = 5
export const PLACEHOLDER_IMAGE = '/placeholder.jpg'

export function formatMNT(amount: number) {
  return `${Math.round(amount).toLocaleString('en-US')}₮`
}

export function totalStock(product: Pick<Product, 'variants'>) {
  return product.variants.reduce((sum, variant) => sum + Math.max(0, variant.stock), 0)
}

export function variantStock(product: Pick<Product, 'variants'>, size?: string) {
  return product.variants.find((variant) => variant.size === (size ?? ''))?.stock ?? 0
}

export function coverImage(product: Pick<Product, 'images'>) {
  return product.images[0] || PLACEHOLDER_IMAGE
}

/** "Хэмжээ 128" for sized items, nothing for the rest. */
export function sizeLabel(size?: string) {
  return size ? `Хэмжээ ${size}` : ''
}
