import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Mail, Pencil } from 'lucide-react'
import { removeAdmin } from '@/app/actions/admin-users'
import { ConfirmDelete } from '@/components/admin/confirm-delete'
import { Flash, type FlashMessage } from '@/components/admin/flash'
import { AdminAvatar, AdminLink, Card, CardHeader, DetailList, PageHeader, formatDateTime, timeAgo } from '@/components/admin/ui'
import { countAdmins, getAdminById } from '@/lib/admin-users'
import { requireAdmin } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Админ' }

const flashes: Record<string, FlashMessage> = {
  created: { tone: 'success', text: 'Админ амжилттай үүслээ.' },
  updated: { tone: 'success', text: 'Өөрчлөлт хадгалагдлаа.' },
  self: { tone: 'warning', text: 'Өөрийн бүртгэлийг устгах боломжгүй.' },
  last: { tone: 'warning', text: 'Сүүлийн админыг устгах боломжгүй.' },
}

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ flash?: string }>
}) {
  const me = await requireAdmin()
  const [{ id }, { flash }] = await Promise.all([params, searchParams])
  const [admin, total] = await Promise.all([getAdminById(id), countAdmins()])
  if (!admin) notFound()
  const isMe = admin.id === me.id

  return (
    <>
      <PageHeader
        back={{ href: '/admin/users', label: 'Админууд' }}
        eyebrow="Админ"
        title={admin.name}
        actions={
          <AdminLink href={`/admin/users/${admin.id}/edit`}>
            <Pencil aria-hidden="true" />
            Засах
          </AdminLink>
        }
      />
      <Flash message={flash ? flashes[flash] : undefined} />

      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <Card className="relative flex flex-col items-center gap-4 self-start overflow-hidden px-6 pb-8 pt-12 text-center">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-primary-deep to-primary" aria-hidden="true" />
          <div className="relative rounded-2xl bg-card p-3 shadow-lg shadow-primary/10">
            <AdminAvatar name={admin.name} highlight={isMe} size="lg" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-xl font-bold text-foreground">{admin.name}</p>
            <a href={`mailto:${admin.email}`} className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <Mail className="size-4" aria-hidden="true" />
              {admin.email}
            </a>
          </div>
          {isMe && <span className="rounded-full bg-highlight/25 px-3 py-1 text-xs font-semibold text-primary">Таны бүртгэл</span>}
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Бүртгэлийн мэдээлэл" />
            <DetailList
              items={[
                ['Нэр', admin.name],
                ['Имэйл', admin.email],
                ['Бүртгэсэн', formatDateTime(admin.createdAt)],
                ['Шинэчилсэн', formatDateTime(admin.updatedAt)],
                ['Сүүлд нэвтэрсэн', admin.lastLoginAt ? `${formatDateTime(admin.lastLoginAt)} (${timeAgo(admin.lastLoginAt)})` : 'Нэвтэрч байгаагүй'],
              ]}
            />
          </Card>
          <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-bold text-foreground">Админ устгах</h2>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {isMe
                  ? 'Өөрийн бүртгэлийг устгах боломжгүй.'
                  : total <= 1
                    ? 'Сүүлийн админыг устгах боломжгүй.'
                    : 'Устгасан админ системд нэвтрэх эрхээ шууд алдана.'}
              </p>
            </div>
            <ConfirmDelete
              disabled={isMe || total <= 1}
              action={removeAdmin.bind(null, admin.id)}
              label="Админ устгах"
              title="Админыг устгах уу?"
              description={`${admin.name} (${admin.email}) системд нэвтрэх эрхээ шууд алдана.`}
            />
          </Card>
        </div>
      </div>
    </>
  )
}
