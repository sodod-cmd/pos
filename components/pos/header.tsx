import Image from 'next/image'
import Link from 'next/link'
import { LayoutDashboard } from 'lucide-react'

export function Header() {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.webp"
            alt="Сургуулийн лого"
            width={156}
            height={48}
            priority
            className="h-11 w-auto object-contain"
          />
        </div>
        <div className="flex items-center gap-2">
          <p className="hidden rounded-full bg-highlight px-3 py-1 text-xs font-semibold text-highlight-foreground sm:block">
            Дүрэмт хувцас · Ном · Дэвтэр
          </p>
          <Link
            href="/admin"
            className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground"
          >
            <LayoutDashboard aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">Удирдлага</span>
            <span className="sr-only sm:hidden">Удирдлагын хэсэг</span>
          </Link>
        </div>
      </div>
    </header>
  )
}
