import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { saveAdmin } from '@/app/actions/admin-users'
import { PageHeader } from '@/components/admin/ui'
import { UserForm } from '@/components/admin/user-form'
import { MIN_PASSWORD_LENGTH, getAdminById } from '@/lib/admin-users'
import { requireAdmin } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Админ засах' }

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const admin = await getAdminById(id)
  if (!admin) notFound()

  return (
    <>
      <PageHeader back={{ href: `/admin/users/${id}`, label: admin.name }} eyebrow="Админ засах" title={admin.name} />
      <UserForm
        action={saveAdmin.bind(null, id)}
        user={{ name: admin.name, email: admin.email }}
        cancelHref={`/admin/users/${id}`}
        minPassword={MIN_PASSWORD_LENGTH}
      />
    </>
  )
}
