import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { requireAdmin } from '@/lib/auth/session'
import { getNavCounts } from '@/lib/nav-counts'
import { SCHOOL_NAME } from '@/lib/school'

export default async function AdminPanelLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const admin = await requireAdmin()
  const counts = await getNavCounts()
  return (
    <div className="min-h-dvh bg-surface lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)]">
      <AdminSidebar admin={{ name: admin.name, email: admin.email }} schoolName={SCHOOL_NAME} stockAlerts={counts.stockAlerts} pendingOrders={counts.pendingOrders} />
      <main id="main" className="px-4 py-6 sm:px-6 md:py-10 lg:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-8">{children}</div>
      </main>
    </div>
  )
}
