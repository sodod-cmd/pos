import type { Metadata } from 'next'
import { MovementList } from '@/components/admin/movement-list'
import { Card, FilterTabs, PageHeader, Pagination } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth/session'
import { getProductById } from '@/lib/catalog'
import { MOVEMENT_LABELS, isMovementType, listMovements, type MovementType } from '@/lib/inventory'

export const metadata: Metadata = { title: 'Үлдэгдлийн хөдөлгөөн' }

type Params = { type?: string; product?: string; page?: string }

export default async function InventoryHistoryPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin()
  const params = await searchParams
  const type = isMovementType(params.type) ? params.type : undefined
  const productId = params.product || undefined
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1)
  const [result, product] = await Promise.all([listMovements({ type, productId, page }), productId ? getProductById(productId) : null])

  function href(patch: Partial<Params>) {
    const merged = { type, product: productId, ...patch }
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v)
    const s = sp.toString()
    return s ? `/admin/inventory/history?${s}` : '/admin/inventory/history'
  }

  return (
    <>
      <PageHeader
        back={product ? { href: `/admin/products/${product.id}`, label: product.name } : { href: '/admin/inventory', label: 'Агуулах' }}
        eyebrow="Агуулах"
        title={product ? `${product.name}: хөдөлгөөн` : 'Үлдэгдлийн хөдөлгөөн'}
        description="Орлого, борлуулалт, буцаалт, тооллого, хорогдол бүр хэн, хэзээ, хэдээр өөрчилснийг бүртгэнэ."
      />
      <Card>
        <div className="border-b border-border/80 p-3 md:p-4">
          <FilterTabs
            label="Төрлөөр шүүх"
            tabs={[
              { href: href({ type: undefined, page: undefined }), label: 'Бүгд', active: !type },
              ...(Object.keys(MOVEMENT_LABELS) as MovementType[]).map((t) => ({ href: href({ type: t, page: undefined }), label: MOVEMENT_LABELS[t], active: type === t })),
            ]}
          />
        </div>
        <p className="border-b border-border/80 px-5 py-2.5 text-xs text-muted-foreground md:px-6">{result.total} бичлэг</p>
        <MovementList items={result.items} showProduct={!product} />
        <Pagination page={page} pages={result.pages} href={(p) => href({ page: p > 1 ? String(p) : undefined })} />
      </Card>
    </>
  )
}
