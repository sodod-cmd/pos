import type { Metadata } from 'next'
import Link from 'next/link'
import { Eye, Pencil, UserPlus } from 'lucide-react'
import { removeAdmin } from '@/app/actions/admin-users'
import { ConfirmDelete } from '@/components/admin/confirm-delete'
import { Flash, type FlashMessage } from '@/components/admin/flash'
import { AdminAvatar, AdminLink, Card, PageHeader, adminButton, formatDateTime, timeAgo } from '@/components/admin/ui'
import { listAdmins } from '@/lib/admin-users'
import { requireAdmin } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Админууд' }

const flashes: Record<string, FlashMessage> = {
  deleted: { tone: 'success', text: 'Админ устгагдлаа.' },
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ flash?: string }> }) {
  const me = await requireAdmin()
  const [admins, { flash }] = await Promise.all([listAdmins(), searchParams])

  return (
    <>
      <PageHeader
        eyebrow="Хандалт"
        title="Админууд"
        description="Удирдлагын системд нэвтрэх эрхтэй хэрэглэгчид."
        actions={
          <AdminLink href="/admin/users/new" variant="primary">
            <UserPlus aria-hidden="true" />
            Админ нэмэх
          </AdminLink>
        }
      />
      <Flash message={flash ? flashes[flash] : undefined} />

      <Card>
        <div className="hidden grid-cols-[minmax(0,1fr)_10rem_10rem_7rem] gap-4 border-b border-border/80 px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground md:grid">
          <span>Админ</span>
          <span>Бүртгэсэн</span>
          <span>Сүүлд нэвтэрсэн</span>
          <span className="text-right">Үйлдэл</span>
        </div>
        <ul className="divide-y divide-border/80">
          {admins.map((admin) => {
            const isMe = admin.id === me.id
            return (
              <li
                key={admin.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 transition-colors hover:bg-surface/60 md:grid-cols-[minmax(0,1fr)_10rem_10rem_7rem] md:px-6"
              >
                <Link href={`/admin/users/${admin.id}`} className="flex min-w-0 items-center gap-4">
                  <AdminAvatar name={admin.name} highlight={isMe} />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex items-center gap-2 truncate text-sm font-bold text-foreground hover:underline">
                      {admin.name}
                      {isMe && <span className="rounded-md bg-highlight/25 px-1.5 py-0.5 text-[11px] font-semibold text-primary">Та</span>}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{admin.email}</span>
                  </span>
                </Link>
                <span className="hidden text-sm text-muted-foreground md:block">{formatDateTime(admin.createdAt).split(' ')[0]}</span>
                <span className="hidden text-sm text-muted-foreground md:block">{timeAgo(admin.lastLoginAt)}</span>
                <span className="flex items-center justify-end gap-0.5">
                  <Link href={`/admin/users/${admin.id}`} className={adminButton({ variant: 'ghost', size: 'icon' })} title="Харах">
                    <Eye aria-hidden="true" />
                    <span className="sr-only">Харах: {admin.name}</span>
                  </Link>
                  <Link href={`/admin/users/${admin.id}/edit`} className={adminButton({ variant: 'ghost', size: 'icon' })} title="Засах">
                    <Pencil aria-hidden="true" />
                    <span className="sr-only">Засах: {admin.name}</span>
                  </Link>
                  <ConfirmDelete
                    iconOnly
                    disabled={isMe || admins.length <= 1}
                    action={removeAdmin.bind(null, admin.id)}
                    label={isMe ? 'Өөрийгөө устгах боломжгүй' : 'Устгах'}
                    title="Админыг устгах уу?"
                    description={`${admin.name} (${admin.email}) системд нэвтрэх эрхээ шууд алдана.`}
                  />
                </span>
              </li>
            )
          })}
        </ul>
      </Card>
    </>
  )
}
