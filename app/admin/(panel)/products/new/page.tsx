import type { Metadata } from 'next'
import { saveProduct } from '@/app/actions/admin-products'
import { ProductForm } from '@/components/admin/product-form'
import { AdminLink, Card, EmptyState, PageHeader } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth/session'
import { categoryOptions } from '@/lib/catalog'
import { isS3Configured } from '@/lib/s3'

export const metadata: Metadata = { title: 'Шинэ бараа' }

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  await requireAdmin()
  const [categories, { category }] = await Promise.all([categoryOptions(), searchParams])
  const ordered = category ? [...categories].sort((a, b) => Number(b.id === category) - Number(a.id === category)) : categories

  return (
    <>
      <PageHeader
        back={{ href: '/admin/products', label: 'Бараа' }}
        eyebrow="Бараа материал"
        title="Шинэ бараа бүртгэх"
        description="Нэр, үнэ, хэмжээ, одоо байгаа үлдэгдлээ оруулаад хадгална. Дараа нь «Агуулах» цэсээс орлого, тооллогоо бүртгэнэ."
      />
      {categories.length === 0 ? (
        <Card>
          <EmptyState
            title="Ангилал алга байна"
            text="Бараа бүртгэхийн өмнө Хувцас, Ном, Дэвтэр гэх мэт ангилал үүсгэнэ үү."
            action={<AdminLink href="/admin/categories/new" variant="primary">Ангилал нэмэх</AdminLink>}
          />
        </Card>
      ) : (
        <ProductForm action={saveProduct.bind(null, null)} categories={ordered} s3Configured={isS3Configured()} />
      )}
    </>
  )
}
