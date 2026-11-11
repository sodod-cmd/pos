import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, Pencil } from 'lucide-react'
import { quickStock, removeProduct, toggleProductActive } from '@/app/actions/admin-products'
import { ConfirmDelete } from '@/components/admin/confirm-delete'
import { Flash, type FlashMessage } from '@/components/admin/flash'
import { MovementList } from '@/components/admin/movement-list'
import { QuickStockForm } from '@/components/admin/quick-stock-form'
import { ActiveToggle } from '@/components/admin/toggle-button'
import { AdminLink, Badge, Card, CardHeader, DetailList, PageHeader, formatDateTime } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth/session'
import { getProductById, stockStatus } from '@/lib/catalog'
import { STOCK_STATUS_LABELS } from '@/lib/catalog-status'
import { listMovements } from '@/lib/inventory'
import { productSales } from '@/lib/orders'
import { PLACEHOLDER_IMAGE, formatMNT } from '@/lib/products'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Бараа' }

const flashes: Record<string, FlashMessage> = {
  created: { tone: 'success', text: 'Бараа бүртгэгдлээ. Борлуулалтын цэг дээр шууд харагдана.' },
  updated: { tone: 'success', text: 'Өөрчлөлт хадгалагдлаа.' },
}

export default async function ProductDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ flash?: string }> }) {
  await requireAdmin()
  const [{ id }, { flash }] = await Promise.all([params, searchParams])
  const product = await getProductById(id)
  if (!product) notFound()
  const [sales, movements] = await Promise.all([productSales(id, 30), listMovements({ productId: id })])
  const soldBySize = new Map(sales.bySize.map((s) => [s.size, s.qty]))
  const maxStock = Math.max(1, ...product.variants.map((v) => v.stock))

  return (
    <>
      <PageHeader
        back={{ href: '/admin/products', label: 'Бараа' }}
        eyebrow={product.categoryName}
        title={product.name}
        actions={
          <>
            <ActiveToggle action={toggleProductActive.bind(null, product.id)} active={product.active} />
            <AdminLink href={`/admin/products/${product.id}/edit`}>
              <Pencil aria-hidden="true" />
              Засах
            </AdminLink>
          </>
        }
      />
      <Flash message={flash ? flashes[flash] : undefined} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader
              title={product.hasSizes ? 'Хэмжээ тус бүрийн үлдэгдэл' : 'Үлдэгдэл'}
              description={`Нийт ${product.totalStock} ширхэг · ${formatMNT(product.totalStock * product.price)} үнэлгээтэй · хязгаар ${product.lowStockThreshold} ш`}
              action={product.active ? <Badge tone="success">Зарагдаж буй</Badge> : <Badge>Нуусан</Badge>}
            />
            <ul className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:p-5 xl:grid-cols-4">
              {product.variants.map((variant) => {
                const status = stockStatus(variant.stock, product.lowStockThreshold)
                return (
                  <li
                    key={variant.size}
                    className={cn(
                      'flex flex-col gap-2 rounded-xl border p-3',
                      status === 'out' && 'border-destructive/30 bg-destructive/5',
                      status === 'low' && 'border-warning/60 bg-warning/10',
                      status === 'ok' && 'border-border bg-card',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">{variant.size || 'Үлдэгдэл'}</span>
                      <span
                        className={cn(
                          'text-[11px] font-semibold',
                          status === 'out' && 'text-destructive',
                          status === 'low' && 'text-warning-foreground',
                          status === 'ok' && 'text-success',
                        )}
                      >
                        {STOCK_STATUS_LABELS[status]}
                      </span>
                    </div>
                    <p className="flex items-baseline gap-1">
                      <span className="text-3xl leading-none font-extrabold">{variant.stock}</span>
                      <span className="text-xs text-muted-foreground">ш</span>
                    </p>
                    <div className="h-1.5 overflow-hidden rounded-full bg-border/70" aria-hidden="true">
                      <div
                        className={cn('h-full rounded-full', status === 'out' ? 'bg-destructive' : status === 'low' ? 'bg-warning' : 'bg-success')}
                        style={{ width: `${Math.max(0, (variant.stock / maxStock) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground">30 хоногт {soldBySize.get(variant.size) ?? 0} зарагдсан</span>
                  </li>
                )
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader
              title="Үлдэгдлийн хөдөлгөөн"
              action={
                <Link href={`/admin/inventory/history?product=${product.id}`} className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                  Бүгдийг харах <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              }
            />
            <MovementList items={movements.items.slice(0, 15)} showProduct={false} />
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Үлдэгдэл бүртгэх" description="Орлого, хорогдол, тооллого" />
            <div className="p-5">
              <QuickStockForm action={quickStock.bind(null, product.id)} sizes={product.variants} />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="relative aspect-square bg-surface">
              <Image src={product.images[0] || PLACEHOLDER_IMAGE} alt={product.name} fill sizes="22rem" className="object-cover" />
            </div>
            {product.images.length > 1 && (
              <ul className="flex gap-2 overflow-x-auto p-3">
                {product.images.slice(1).map((src) => (
                  <li key={src} className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-surface">
                    <Image src={src} alt="" fill sizes="56px" className="object-cover" />
                  </li>
                ))}
              </ul>
            )}
            <DetailList
              items={[
                ['Үнэ', <span key="p" className="font-bold text-primary">{formatMNT(product.price)}</span>],
                ['Ангилал', product.categoryName],
                ['30 хоногт', `${sales.qty} ш · ${formatMNT(sales.revenue)}`],
                ['Бүртгэсэн', formatDateTime(product.createdAt)],
                ['Шинэчилсэн', formatDateTime(product.updatedAt)],
              ]}
            />
            {product.description && <p className="border-t border-border/80 px-5 py-4 text-sm leading-relaxed text-muted-foreground md:px-6">{product.description}</p>}
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-bold">Бараа устгах</h2>
              <p className="text-xs leading-relaxed text-muted-foreground">Зарагдсан захиалгууд хэвээр үлдэнэ. Түр зарахгүй бол «нуух» нь илүү тохиромжтой.</p>
            </div>
            <ConfirmDelete
              action={removeProduct.bind(null, product.id)}
              label="Бараа устгах"
              title="Барааг устгах уу?"
              description={`«${product.name}» бүрмөсөн устах бөгөөд сэргээх боломжгүй.`}
            />
          </Card>
        </div>
      </div>
    </>
  )
}
