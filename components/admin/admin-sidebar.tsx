'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Boxes,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  Store,
  Tags,
  Users,
  X,
} from 'lucide-react'
import { logout } from '@/app/actions/auth'
import { AdminAvatar } from '@/components/admin/ui'
import { cn } from '@/lib/utils'

type NavItem = { href: string; label: string; icon: typeof Package; badge?: number }

function isActive(pathname: string, href: string) {
  return href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`)
}

function Brand({ schoolName }: { schoolName: string }) {
  return (
    <Link href="/admin" className="flex min-w-0 items-center gap-3 rounded-lg">
      <span className="relative flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5 shadow-lg shadow-black/20">
        <Image src="/logo.webp" alt="" width={156} height={48} className="h-full w-auto object-contain" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-bold text-primary-foreground">{schoolName}</span>
        <span className="text-[10px] font-semibold tracking-[0.2em] text-highlight uppercase">Борлуулалтын удирдлага</span>
      </span>
    </Link>
  )
}

export function AdminSidebar({
  admin,
  schoolName,
  stockAlerts,
  pendingOrders,
}: {
  admin: { name: string; email: string }
  schoolName: string
  stockAlerts: number
  pendingOrders: number
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [lastPath, setLastPath] = useState(pathname)

  if (lastPath !== pathname) {
    setLastPath(pathname)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: 'Борлуулалт',
      items: [
        { href: '/admin', label: 'Хянах самбар', icon: LayoutDashboard },
        { href: '/admin/orders', label: 'Захиалга, худалдан авалт', icon: ReceiptText, badge: pendingOrders },
      ],
    },
    {
      title: 'Бараа материал',
      items: [
        { href: '/admin/products', label: 'Бараа', icon: Package },
        { href: '/admin/inventory', label: 'Агуулах, үлдэгдэл', icon: Boxes, badge: stockAlerts },
        { href: '/admin/categories', label: 'Ангилал', icon: Tags },
      ],
    },
    { title: 'Тохиргоо', items: [{ href: '/admin/users', label: 'Админууд', icon: Users }] },
  ]

  return (
    <>
      <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-primary-deep px-4 lg:hidden">
        <Brand schoolName={schoolName} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="admin-nav"
          className="flex size-10 items-center justify-center rounded-lg text-primary-foreground hover:bg-white/10"
        >
          <Menu className="size-5" aria-hidden="true" />
          <span className="sr-only">Цэс нээх</span>
        </button>
      </div>

      {open && <div className="fixed inset-0 z-40 bg-primary-deep/50 backdrop-blur-sm lg:hidden" aria-hidden="true" onClick={() => setOpen(false)} />}

      <aside
        id="admin-nav"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-hidden bg-primary-deep text-primary-foreground transition-transform duration-300 lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-auto lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full bg-highlight/15 blur-3xl" aria-hidden="true" />

        <div className="relative flex h-20 items-center justify-between gap-2 px-5">
          <Brand schoolName={schoolName} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-primary-foreground/70 hover:bg-white/10 lg:hidden"
          >
            <X className="size-5" aria-hidden="true" />
            <span className="sr-only">Цэс хаах</span>
          </button>
        </div>

        <nav aria-label="Админ цэс" className="relative flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-2">
          <Link
            href="/"
            className="mb-3 flex items-center gap-3 rounded-xl bg-highlight px-3 py-2.5 text-sm font-bold text-highlight-foreground shadow-lg shadow-black/20 transition-colors hover:bg-highlight/90"
          >
            <Store className="size-4" aria-hidden="true" />
            Борлуулалтын цэг нээх
          </Link>

          {groups.map((group) => (
            <div key={group.title} className="flex flex-col gap-1">
              <p className="px-3 pt-4 pb-2 text-[10px] font-semibold tracking-[0.24em] text-primary-foreground/45 uppercase">{group.title}</p>
              {group.items.map(({ href, label, icon: Icon, badge }) => {
                const active = isActive(pathname, href)
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                      active ? 'bg-white/12 text-primary-foreground' : 'text-primary-foreground/70 hover:bg-white/6 hover:text-primary-foreground',
                    )}
                  >
                    <span
                      className={cn('absolute top-1/2 -left-4 h-6 w-1 -translate-y-1/2 rounded-r-full bg-highlight transition-opacity', active ? 'opacity-100' : 'opacity-0')}
                      aria-hidden="true"
                    />
                    <span
                      className={cn(
                        'flex size-8 items-center justify-center rounded-lg transition-colors',
                        active ? 'bg-highlight text-highlight-foreground' : 'bg-white/6 text-primary-foreground/75 group-hover:text-primary-foreground',
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="flex-1">{label}</span>
                    {badge ? (
                      <span className="rounded-full bg-highlight px-2 py-0.5 text-[11px] font-bold text-highlight-foreground">
                        {badge}
                        <span className="sr-only"> анхаарах</span>
                      </span>
                    ) : null}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="relative m-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/6 p-3">
          <AdminAvatar name={admin.name} highlight />
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="truncate text-sm font-bold">{admin.name}</p>
            <p className="truncate text-xs text-primary-foreground/60">{admin.email}</p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="flex size-9 items-center justify-center rounded-lg text-primary-foreground/65 transition-colors hover:bg-white/10 hover:text-highlight"
              title="Гарах"
            >
              <LogOut className="size-4" aria-hidden="true" />
              <span className="sr-only">Гарах</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}
