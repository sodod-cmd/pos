'use client'

import type { CategoryOption, Product } from '@/lib/products'
import { CartProvider } from './cart-context'
import { CartDock } from './cart-dock'
import { Catalog } from './catalog'
import { Header } from './header'

export function PosApp({ categories, products }: { categories: CategoryOption[]; products: Product[] }) {
  return (
    <CartProvider products={products}>
      <Header />
      <main className="mx-auto max-w-6xl px-4 pt-6 pb-40 sm:px-6">
        <Catalog categories={categories} products={products} />
      </main>
      <CartDock />
    </CartProvider>
  )
}
