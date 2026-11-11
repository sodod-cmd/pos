import type { Metadata } from 'next'
import { saveCategory } from '@/app/actions/admin-categories'
import { CategoryForm } from '@/components/admin/category-form'
import { PageHeader } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Шинэ ангилал' }

export default async function NewCategoryPage() {
  await requireAdmin()
  return (
    <>
      <PageHeader back={{ href: '/admin/categories', label: 'Ангилал' }} eyebrow="Бараа материал" title="Шинэ ангилал" />
      <CategoryForm action={saveCategory.bind(null, null)} />
    </>
  )
}
