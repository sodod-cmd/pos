'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { CategoryOption, Product } from '@/lib/products'
import { ProductCard } from './product-card'

export function Catalog({ categories, products }: { categories: CategoryOption[]; products: Product[] }) {
  const [filter, setFilter] = useState<string>('all')
  const [query, setQuery] = useState('')

  const filters = [{ value: 'all', label: 'Бүгд' }, ...categories.map((category) => ({ value: category.id, label: category.name }))]
  const normalizedQuery = query.trim().toLowerCase()
  const visible = products.filter(
    (product) =>
      (filter === 'all' || product.categoryId === filter) &&
      (normalizedQuery === '' || product.name.toLowerCase().includes(normalizedQuery)),
  )

  return (
    <section aria-label="Бүтээгдэхүүний жагсаалт" className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Ангилал">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
              className={cn(
                'min-h-10 rounded-full border px-5 text-sm font-medium transition-colors',
                filter === item.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-card hover:border-primary/60',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Бүтээгдэхүүн хайх"
            aria-label="Бүтээгдэхүүн хайх"
            className="h-10 bg-card pl-9"
          />
        </div>
      </div>

      {visible.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-border bg-card py-16 text-center text-muted-foreground">
          {products.length === 0 ? 'Худалдаалж буй бараа алга байна.' : 'Хайлтад тохирох бүтээгдэхүүн олдсонгүй.'}
        </p>
      )}
    </section>
  )
}
