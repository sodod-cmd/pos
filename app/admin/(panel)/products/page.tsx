import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Package, Pencil, Plus, Search } from 'lucide-react'
import { removeProduct, toggleProductActive } from '@/app/actions/admin-products'
import { ConfirmDelete } from '@/components/admin/confirm-delete'
import { Flash, type FlashMessage } from '@/components/admin/flash'
import { StockChips } from '@/components/admin/stock-chips'
import { ActiveToggle } from '@/components/admin/toggle-button'
import { AdminLink, Badge, Card, EmptyState, FilterTabs, PageHeader, adminButton } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth/session'
import { listCategories, listProducts, type ProductListFilter } from '@/lib/catalog'
import { PLACEHOLDER_IMAGE, formatMNT } from '@/lib/products'

export const metadata: Metadata = { title: 'Бараа' }

const flashes: Record<string, FlashMessage> = {
  deleted: { tone: 'success', text: 'Бараа устгагдлаа. Өмнөх борлуулалтын түүх хэвээр үлдэнэ.' },
}

type Params = { q?: string; category?: string; status?: string; stock?: string; flash?: string }

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin()
  const params = await searchParams
  const filter: ProductListFilter = {
    q: params.q?.trim().slice(0, 100) || undefined,
    categoryId: params.category || undefined,
    status: params.status === 'active' || params.status === 'hidden' ? params.status : undefined,
    stock: params.stock === 'low' || params.stock === 'out' ? params.stock : undefined,
  }
  const [products, categories, all] = await Promise.all([listProducts(filter), listCategories(), listProducts()])

  function href(patch: Partial<Params>) {
    const merged = { q: filter.q, category: filter.categoryId, status: filter.status, stock: filter.stock, ...patch }
    const sp = new URLSearchParams()
    for (const [key, value] of Object.entries(merged)) if (value) sp.set(key, value)
    const s = sp.toString()
    return s ? `/admin/products?${s}` : '/admin/products'
  }

  const hasFilter = Boolean(filter.q || filter.categoryId || filter.status || filter.stock)
  const lowCount = all.filter((p) => p.active && (p.lowVariants.length || p.outVariants.length)).length

  return (
    <>
      <PageHeader
        eyebrow="Бараа материал"
        title="Бараа"
        description="Борлуулалтын цэг дээр зарагдах бараа, үнэ, хэмжээ тус бүрийн үлдэгдэл."
        actions={
          <AdminLink href="/admin/products/new" variant="primary">
            <Plus aria-hidden="true" />
            Бараа нэмэх
          </AdminLink>
        }
      />
      <Flash message={params.flash ? flashes[params.flash] : undefined} />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border/80 p-3 md:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <FilterTabs
              label="Ангиллаар шүүх"
              tabs={[
                { href: href({ category: undefined }), label: 'Бүгд', count: all.length, active: !filter.categoryId },
                ...categories.map((c) => ({ href: href({ category: c.id }), label: c.name, count: c.productCount, active: filter.categoryId === c.id })),
              ]}
            />
            <form role="search" className="relative lg:w-72">
              {filter.categoryId && <input type="hidden" name="category" value={filter.categoryId} />}
              {filter.status && <input type="hidden" name="status" value={filter.status} />}
              {filter.stock && <input type="hidden" name="stock" value={filter.stock} />}
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="q" className="sr-only">
                Бараа хайх
              </label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={filter.q}
                placeholder="Нэрээр хайх…"
                className="h-10 w-full rounded-xl border border-input/80 bg-card pr-3 pl-9 text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none"
              />
            </form>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {(
              [
                { label: 'Бүх төлөв', patch: { status: undefined }, active: !filter.status },
                { label: 'Зарагдаж буй', patch: { status: 'active' }, active: filter.status === 'active' },
                { label: 'Нуусан', patch: { status: 'hidden' }, active: filter.status === 'hidden' },
              ] as const
            ).map((chip) => (
              <Link
                key={chip.label}
                href={href(chip.patch)}
                aria-current={chip.active ? 'true' : undefined}
                className={`rounded-full border px-3 py-1 font-semibold transition-colors ${chip.active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-primary'}`}
              >
                {chip.label}
              </Link>
            ))}
            <span className="mx-1 w-px bg-border" aria-hidden="true" />
            {(
              [
                { label: 'Бүх үлдэгдэл', patch: { stock: undefined }, active: !filter.stock },
                { label: `Дуусч буй (${lowCount})`, patch: { stock: 'low' }, active: filter.stock === 'low' },
                { label: 'Дууссан хэмжээтэй', patch: { stock: 'out' }, active: filter.stock === 'out' },
              ] as const
            ).map((chip) => (
              <Link
                key={chip.label}
                href={href(chip.patch)}
                aria-current={chip.active ? 'true' : undefined}
                className={`rounded-full border px-3 py-1 font-semibold transition-colors ${chip.active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-primary'}`}
              >
                {chip.label}
              </Link>
            ))}
          </div>
        </div>

        {products.length === 0 ? (
          <EmptyState
            icon={Package}
            title={hasFilter ? 'Илэрц олдсонгүй' : 'Бараа бүртгэгдээгүй байна'}
            text={hasFilter ? 'Шүүлтүүрт тохирох бараа алга.' : categories.length === 0 ? 'Эхлээд ангилал үүсгээд дараа нь бараагаа бүртгэнэ.' : 'Эхний бараагаа бүртгэж борлуулалтаа эхлүүлээрэй.'}
            action={
              hasFilter ? (
                <AdminLink href="/admin/products" variant="outline">
                  Шүүлтүүрийг цэвэрлэх
                </AdminLink>
              ) : (
                <AdminLink href={categories.length === 0 ? '/admin/categories/new' : '/admin/products/new'} variant="primary">
                  <Plus aria-hidden="true" />
                  {categories.length === 0 ? 'Ангилал нэмэх' : 'Бараа нэмэх'}
                </AdminLink>
              )
            }
          />
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1.3fr)_6.5rem_minmax(0,1.2fr)_7rem_8.5rem] gap-4 border-b border-border/80 px-6 py-2.5 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase lg:grid">
              <span>Бараа</span>
              <span className="text-right">Үнэ</span>
              <span>Үлдэгдэл (хэмжээгээр)</span>
              <span>Төлөв</span>
              <span className="text-right">Үйлдэл</span>
            </div>
            <ul className="divide-y divide-border/80">
              {products.map((product) => (
                <li
                  key={product.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-4 py-4 transition-colors hover:bg-surface/60 lg:grid-cols-[minmax(0,1.3fr)_6.5rem_minmax(0,1.2fr)_7rem_8.5rem] lg:px-6"
                >
                  <Link href={`/admin/products/${product.id}`} className="col-span-2 flex min-w-0 items-center gap-4 lg:col-span-1">
                    <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-surface">
                      <Image src={product.images[0] || PLACEHOLDER_IMAGE} alt="" fill sizes="56px" className="object-cover" />
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="line-clamp-2 text-sm leading-snug font-bold hover:underline">{product.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {product.categoryName} · нийт {product.totalStock} ш
                      </span>
                    </span>
                  </Link>
                  <span className="text-sm font-bold text-primary lg:text-right">{formatMNT(product.price)}</span>
                  <span className="col-span-2 lg:col-span-1">
                    <StockChips variants={product.variants} threshold={product.lowStockThreshold} />
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {product.active ? <Badge tone="success">Зарагдаж буй</Badge> : <Badge>Нуусан</Badge>}
                  </span>
                  <span className="flex items-center justify-end gap-0.5">
                    <ActiveToggle action={toggleProductActive.bind(null, product.id)} active={product.active} compact />
                    <Link href={`/admin/products/${product.id}/edit`} className={adminButton({ variant: 'ghost', size: 'icon' })} title="Засах">
                      <Pencil aria-hidden="true" />
                      <span className="sr-only">Засах: {product.name}</span>
                    </Link>
                    <ConfirmDelete
                      iconOnly
                      action={removeProduct.bind(null, product.id)}
                      title="Барааг устгах уу?"
                      description={`«${product.name}» болон түүний ${product.totalStock} ширхэг үлдэгдлийн бүртгэл устна. Зарагдсан захиалгууд хэвээр үлдэнэ. Түр хугацаагаар зарахгүй бол «нуух»-ыг ашиглаарай.`}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </>
  )
}
