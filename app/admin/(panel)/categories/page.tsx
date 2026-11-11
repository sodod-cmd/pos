import type { Metadata } from 'next'
import Link from 'next/link'
import { Pencil, Plus, Ruler, Tags } from 'lucide-react'
import { removeCategory } from '@/app/actions/admin-categories'
import { ConfirmDelete } from '@/components/admin/confirm-delete'
import { Flash, type FlashMessage } from '@/components/admin/flash'
import { AdminLink, Card, EmptyState, PageHeader, adminButton } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth/session'
import { listCategories } from '@/lib/catalog'

export const metadata: Metadata = { title: 'Ангилал' }

const flashes: Record<string, FlashMessage> = {
  created: { tone: 'success', text: 'Ангилал үүслээ.' },
  updated: { tone: 'success', text: 'Ангилал шинэчлэгдлээ.' },
  deleted: { tone: 'success', text: 'Ангилал устгагдлаа.' },
  'in-use': { tone: 'warning', text: 'Энэ ангилалд бараа бүртгэлтэй тул устгах боломжгүй. Эхлээд барааг өөр ангилалд шилжүүлнэ үү.' },
}

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ flash?: string }> }) {
  await requireAdmin()
  const [categories, { flash }] = await Promise.all([listCategories(), searchParams])

  return (
    <>
      <PageHeader
        eyebrow="Бараа материал"
        title="Ангилал"
        description="Борлуулалтын цэгийн шүүлтүүр болон тайланд харагдах барааны бүлгүүд."
        actions={
          <AdminLink href="/admin/categories/new" variant="primary">
            <Plus aria-hidden="true" />
            Ангилал нэмэх
          </AdminLink>
        }
      />
      <Flash message={flash ? flashes[flash] : undefined} />

      <Card>
        {categories.length === 0 ? (
          <EmptyState
            icon={Tags}
            title="Ангилал алга байна"
            text="Хувцас, Ном, Дэвтэр гэх мэт ангиллаа эхлээд үүсгээд бараагаа бүртгэнэ."
            action={
              <AdminLink href="/admin/categories/new" variant="primary">
                <Plus aria-hidden="true" />
                Ангилал нэмэх
              </AdminLink>
            }
          />
        ) : (
          <ul className="divide-y divide-border/80">
            {categories.map((category) => (
              <li key={category.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center md:px-6">
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-sm font-bold text-primary">{category.order}</span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <Link href={`/admin/products?category=${category.id}`} className="font-bold text-foreground hover:underline">
                      {category.name}
                    </Link>
                    {category.description && <p className="text-sm text-muted-foreground">{category.description}</p>}
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        {category.activeCount} худалдаалж буй / {category.productCount} бараа
                      </span>
                      {category.hasSizes && (
                        <span className="inline-flex items-center gap-1">
                          <Ruler className="size-3.5" aria-hidden="true" />
                          {category.sizePresets.length ? category.sizePresets.join(' · ') : 'Хэмжээтэй'}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <span className="flex items-center justify-end gap-0.5">
                  <Link href={`/admin/categories/${category.id}`} className={adminButton({ variant: 'ghost', size: 'icon' })} title="Засах">
                    <Pencil aria-hidden="true" />
                    <span className="sr-only">Засах: {category.name}</span>
                  </Link>
                  <ConfirmDelete
                    iconOnly
                    disabled={category.productCount > 0}
                    label={category.productCount > 0 ? 'Бараатай ангиллыг устгах боломжгүй' : 'Устгах'}
                    action={removeCategory.bind(null, category.id)}
                    title="Ангиллыг устгах уу?"
                    description={`«${category.name}» ангилал бүрмөсөн устна.`}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
