import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { saveCategory } from '@/app/actions/admin-categories'
import { CategoryForm } from '@/components/admin/category-form'
import { PageHeader } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth/session'
import { getCategoryById } from '@/lib/catalog'

export const metadata: Metadata = { title: 'Ангилал засах' }

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const category = await getCategoryById(id)
  if (!category) notFound()
  return (
    <>
      <PageHeader back={{ href: '/admin/categories', label: 'Ангилал' }} eyebrow="Ангилал засах" title={category.name} />
      <CategoryForm action={saveCategory.bind(null, id)} category={category} />
    </>
  )
}
