import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { saveProduct } from '@/app/actions/admin-products'
import { ProductForm } from '@/components/admin/product-form'
import { PageHeader } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth/session'
import { categoryOptions, getProductById } from '@/lib/catalog'
import { isS3Configured } from '@/lib/s3'

export const metadata: Metadata = { title: 'Бараа засах' }

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const [product, categories] = await Promise.all([getProductById(id), categoryOptions()])
  if (!product) notFound()

  return (
    <>
      <PageHeader back={{ href: `/admin/products/${id}`, label: product.name }} eyebrow="Бараа засах" title={product.name} />
      <ProductForm
        action={saveProduct.bind(null, id)}
        categories={categories}
        s3Configured={isS3Configured()}
        product={{
          name: product.name,
          description: product.description,
          categoryId: product.categoryId,
          price: product.price,
          lowStockThreshold: product.lowStockThreshold,
          active: product.active,
          images: product.images,
          variants: product.variants,
        }}
      />
    </>
  )
}
