import Link from 'next/link'
import { cva, type VariantProps } from 'class-variance-authority'
import { PackageOpen } from 'lucide-react'
import { TIME_ZONE } from '@/lib/time'
import { cn } from '@/lib/utils'

export const adminButton = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-[background-color,border-color,color,box-shadow,transform] active:translate-y-px disabled:pointer-events-none disabled:opacity-60 aria-disabled:pointer-events-none aria-disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-highlight text-highlight-foreground shadow-sm shadow-highlight/30 hover:bg-highlight/85',
        brand: 'bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary-deep',
        outline: 'border border-border bg-card text-primary hover:border-primary/30 hover:bg-surface',
        ghost: 'text-muted-foreground hover:bg-primary/5 hover:text-primary',
        danger: 'border border-destructive/20 bg-destructive/5 text-destructive hover:border-destructive/40 hover:bg-destructive/10',
        dangerSolid: 'bg-destructive text-white shadow-sm hover:bg-destructive/90',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-4.5 text-sm',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'brand', size: 'md' },
  },
)

export function AdminLink({
  href,
  variant,
  size,
  className,
  children,
  ...rest
}: VariantProps<typeof adminButton> & { href: string; className?: string; children: React.ReactNode } & Omit<
    React.ComponentProps<typeof Link>,
    'href' | 'className'
  >) {
  return (
    <Link href={href} className={cn(adminButton({ variant, size }), className)} {...rest}>
      {children}
    </Link>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  back,
}: {
  eyebrow: string
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  back?: { href: string; label: string }
}) {
  return (
    <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="flex min-w-0 flex-col gap-3">
        {back && (
          <Link href={back.href} className="w-fit text-sm font-semibold text-muted-foreground transition-colors hover:text-primary">
            ← {back.label}
          </Link>
        )}
        <p className="eyebrow flex items-center gap-3 text-primary/70">
          <span className="h-px w-6 bg-highlight" aria-hidden="true" />
          {eyebrow}
        </p>
        <h1 className="text-2xl leading-tight font-bold text-balance text-foreground md:text-3xl">{title}</h1>
        {description && <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function Card({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('rounded-2xl border border-border/80 bg-card shadow-[0_1px_2px_rgb(36_26_44/0.04)]', className)} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ title, description, action, id }: { title: string; description?: string; action?: React.ReactNode; id?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/80 px-5 py-4 md:px-6">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 id={id} className="text-base font-bold text-foreground">
          {title}
        </h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'brand'

const toneClass: Record<Tone, { box: string; dot: string }> = {
  success: { box: 'bg-success/10 text-success', dot: 'bg-success' },
  warning: { box: 'bg-warning/20 text-warning-foreground', dot: 'bg-warning' },
  danger: { box: 'bg-destructive/10 text-destructive', dot: 'bg-destructive' },
  neutral: { box: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground/60' },
  brand: { box: 'bg-primary/10 text-primary', dot: 'bg-primary' },
}

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap', toneClass[tone].box, className)}>
      <span className={cn('size-1.5 rounded-full', toneClass[tone].dot)} aria-hidden="true" />
      {children}
    </span>
  )
}

export function initials(name: string) {
  const parts = name.replace(/\./g, '').split(/\s+/).filter(Boolean)
  return parts
    .map((p) => p[0])
    .join('')
    .slice(-2)
    .toUpperCase()
}

export function AdminAvatar({ name, highlight = false, size = 'md' }: { name: string; highlight?: boolean; size?: 'md' | 'lg' }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-bold',
        size === 'lg' ? 'size-16 text-xl' : 'size-10 text-sm',
        highlight ? 'bg-highlight text-highlight-foreground' : 'bg-primary/10 text-primary',
      )}
    >
      {initials(name) || '?'}
    </span>
  )
}

export function EmptyState({ title, text, action, icon: Icon = PackageOpen }: { title: string; text: string; action?: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/8 text-primary">
        <Icon className="size-7" aria-hidden="true" />
      </span>
      <p className="text-lg font-bold text-foreground">{title}</p>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{text}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function DetailList({ items }: { items: [label: string, value: React.ReactNode][] }) {
  return (
    <dl className="flex flex-col divide-y divide-border/80">
      {items.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6 md:px-6">
          <dt className="shrink-0 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">{label}</dt>
          <dd className="min-w-0 text-sm font-medium break-words text-foreground sm:text-right">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Segmented filter tabs that link to the same page with different search params. */
export function FilterTabs({ label, tabs }: { label: string; tabs: { href: string; label: string; count?: number; active: boolean }[] }) {
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto rounded-xl bg-surface p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.href + tab.label}
          href={tab.href}
          aria-current={tab.active ? 'page' : undefined}
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors',
            tab.active ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-primary',
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn('rounded-md px-1.5 text-xs', tab.active ? 'bg-highlight text-highlight-foreground' : 'bg-border/70')}>{tab.count}</span>
          )}
        </Link>
      ))}
    </nav>
  )
}

export function Pagination({ page, pages, href }: { page: number; pages: number; href: (page: number) => string }) {
  if (pages <= 1) return null
  return (
    <nav aria-label="Хуудаслалт" className="flex items-center justify-between gap-3 border-t border-border/80 px-5 py-3 text-sm md:px-6">
      <span className="text-muted-foreground">
        {page} / {pages} хуудас
      </span>
      <span className="flex gap-2">
        <Link href={href(page - 1)} aria-disabled={page <= 1} className={adminButton({ variant: 'outline', size: 'sm' })}>
          Өмнөх
        </Link>
        <Link href={href(page + 1)} aria-disabled={page >= pages} className={adminButton({ variant: 'outline', size: 'sm' })}>
          Дараах
        </Link>
      </span>
    </nav>
  )
}

const dateTime = new Intl.DateTimeFormat('mn-MN', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const dateOnly = new Intl.DateTimeFormat('mn-MN', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })

export function formatDateTime(date?: Date | null) {
  return date ? dateTime.format(date) : '—'
}

export function formatDate(date?: Date | null) {
  return date ? dateOnly.format(date) : '—'
}

const relative = new Intl.RelativeTimeFormat('mn', { numeric: 'auto' })
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
]

export function timeAgo(date?: Date | null, empty = 'Нэвтрээгүй') {
  if (!date) return empty
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  for (const [unit, size] of STEPS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit)
  }
  return 'саяхан'
}

export function formatNumber(value: number) {
  return value.toLocaleString('en-US')
}
