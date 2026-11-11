import type { Metadata } from 'next'
import { AlertTriangle, Boxes, History, PackageX, Search, Wallet } from 'lucide-react'
import { saveStockSheet } from '@/app/actions/admin-inventory'
import { StockSheet } from '@/components/admin/stock-sheet'
import { AdminLink, Card, EmptyState, FilterTabs, PageHeader, formatNumber } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth/session'
import { listCategories, listProducts } from '@/lib/catalog'
import { stockStatus } from '@/lib/catalog-status'
import { formatMNT } from '@/lib/products'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Агуулах, үлдэгдэл' }

type Params = { q?: string; category?: string; stock?: string }

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin()
  const params = await searchParams
  const q = params.q?.trim().slice(0, 100) || undefined
  const categoryId = params.category || undefined
  const stock = params.stock === 'low' || params.stock === 'out' ? params.stock : undefined
  const [all, categories] = await Promise.all([listProducts(), listCategories()])

  // Totals cover the whole catalog; the sheet below follows the filters.
  let units = 0
  let value = 0
  let low = 0
  let out = 0
  for (const p of all) {
    for (const v of p.variants) {
      units += Math.max(0, v.stock)
      value += Math.max(0, v.stock) * p.price
      if (!p.active) continue
      const s = stockStatus(v.stock, p.lowStockThreshold)
      if (s === 'low') low++
      if (s === 'out') out++
    }
  }

  const needle = q?.toLowerCase()
  const shown = all
    .filter((p) => !categoryId || p.categoryId === categoryId)
    .filter((p) => !needle || p.name.toLowerCase().includes(needle))
    .filter((p) => (stock === 'out' ? p.outVariants.length > 0 : stock === 'low' ? p.outVariants.length > 0 || p.lowVariants.length > 0 : true))

  function href(patch: Partial<Params>) {
    const merged = { q, category: categoryId, stock, ...patch }
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v)
    const s = sp.toString()
    return s ? `/admin/inventory?${s}` : '/admin/inventory'
  }

  const stats = [
    { label: 'Нийт үлдэгдэл', value: `${formatNumber(units)} ш`, icon: Boxes, tone: 'text-primary bg-primary/8' },
    { label: 'Үлдэгдлийн үнэлгээ', value: formatMNT(value), icon: Wallet, tone: 'text-primary bg-primary/8' },
    { label: 'Дуусч буй хэмжээ', value: low, icon: AlertTriangle, tone: 'text-warning-foreground bg-warning/20', href: href({ stock: 'low' }) },
    { label: 'Дууссан хэмжээ', value: out, icon: PackageX, tone: 'text-destructive bg-destructive/10', href: href({ stock: 'out' }) },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Бараа материал"
        title="Агуулах, үлдэгдэл"
        description="Бүх барааны хэмжээ тус бүрийн үлдэгдлийг нэг дор харж, орлого, тооллого, хорогдлыг хүснэгтээр бүртгэнэ."
        actions={
          <AdminLink href="/admin/inventory/history" variant="outline">
            <History aria-hidden="true" />
            Хөдөлгөөний түүх
          </AdminLink>
        }
      />

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value: v, icon: Icon, tone, href: link }) => {
          const body = (
            <>
              <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', tone)}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-col">
                <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                <dd className="truncate text-xl font-extrabold">{v}</dd>
              </span>
            </>
          )
          return link ? (
            <a key={label} href={link} className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-4 transition-colors hover:border-primary/30">
              {body}
            </a>
          ) : (
            <div key={label} className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-4">
              {body}
            </div>
          )
        })}
      </dl>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterTabs
          label="Ангиллаар шүүх"
          tabs={[
            { href: href({ category: undefined }), label: 'Бүгд', active: !categoryId },
            ...categories.map((c) => ({ href: href({ category: c.id }), label: c.name, active: categoryId === c.id })),
          ]}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <FilterTabs
            label="Үлдэгдлээр шүүх"
            tabs={[
              { href: href({ stock: undefined }), label: 'Бүгд', active: !stock },
              { href: href({ stock: 'low' }), label: 'Дуусч буй', active: stock === 'low' },
              { href: href({ stock: 'out' }), label: 'Дууссан', active: stock === 'out' },
            ]}
          />
          <form role="search" className="relative sm:w-56">
            {categoryId && <input type="hidden" name="category" value={categoryId} />}
            {stock && <input type="hidden" name="stock" value={stock} />}
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="q" className="sr-only">
              Бараа хайх
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Бараа хайх…"
              className="h-10 w-full rounded-xl border border-input/80 bg-card pr-3 pl-9 text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none"
            />
          </form>
        </div>
      </div>

      {shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={Boxes}
            title={all.length === 0 ? 'Бараа бүртгэгдээгүй' : 'Илэрц олдсонгүй'}
            text={all.length === 0 ? 'Эхлээд бараагаа бүртгэнэ үү.' : 'Шүүлтүүрт тохирох бараа алга.'}
            action={
              <AdminLink href={all.length === 0 ? '/admin/products/new' : '/admin/inventory'} variant="outline">
                {all.length === 0 ? 'Бараа нэмэх' : 'Шүүлтүүрийг цэвэрлэх'}
              </AdminLink>
            }
          />
        </Card>
      ) : (
        <StockSheet
          action={saveStockSheet}
          products={shown.map((p) => ({
            id: p.id,
            name: p.active ? p.name : `${p.name} (нуусан)`,
            categoryName: p.categoryName,
            image: p.images[0],
            threshold: p.lowStockThreshold,
            variants: p.variants,
          }))}
        />
      )}
    </>
  )
}
