import type { Metadata } from 'next'
import { saveAdmin } from '@/app/actions/admin-users'
import { PageHeader } from '@/components/admin/ui'
import { UserForm } from '@/components/admin/user-form'
import { MIN_PASSWORD_LENGTH } from '@/lib/admin-users'
import { requireAdmin } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Шинэ админ' }

export default async function NewUserPage() {
  await requireAdmin()
  return (
    <>
      <PageHeader back={{ href: '/admin/users', label: 'Админууд' }} eyebrow="Хандалт" title="Шинэ админ нэмэх" />
      <UserForm action={saveAdmin.bind(null, null)} cancelHref="/admin/users" minPassword={MIN_PASSWORD_LENGTH} />
    </>
  )
}
