import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  CircleCheck,
  Clock,
  CreditCard,
  ImageOff,
  PackagePlus,
  PackageX,
  Plus,
  ShieldAlert,
  ShoppingBag,
  Store,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { OrderStatusBadge } from '@/components/admin/order-status'
import { BarList, SalesChart } from '@/components/admin/sales-chart'
import { AdminLink, Badge, Card, CardHeader, EmptyState, formatNumber, timeAgo } from '@/components/admin/ui'
import { PAYMENT_SOURCE_LABELS } from '@/lib/pos-types'
import { requireAdmin } from '@/lib/auth/session'
import { getDashboard, type StockAlert } from '@/lib/dashboard'
import { PLACEHOLDER_IMAGE, formatMNT } from '@/lib/products'
import { TIME_ZONE } from '@/lib/time'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Хянах самбар' }

const today = new Intl.DateTimeFormat('mn-MN', { timeZone: TIME_ZONE, dateStyle: 'full' })

function greeting() {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, hour: 'numeric', hour12: false }).format(new Date()))
  if (hour < 12) return 'Өглөөний мэнд'
  if (hour < 18) return 'Өдрийн мэнд'
  return 'Оройн мэнд'
}

/** "Б. Болд" → "Болд": Mongolian names lead with the father's initial. Other names stay whole. */
function givenName(name: string) {
  const parts = name.trim().split(/\s+/)
  return parts.length > 1 && /^[^\s.]{1,2}\.$/.test(parts[0]) ? parts.slice(1).join(' ') : name.trim()
}

function Change({ now, before, label }: { now: number; before: number; label: string }) {
  if (before === 0 && now === 0) return <span className="text-xs text-muted-foreground">{label}: борлуулалтгүй</span>
  if (before === 0) return <span className="text-xs text-muted-foreground">{label}: 0₮</span>
  const pct = Math.round(((now - before) / before) * 100)
  const up = pct >= 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <span className={cn('inline-flex items-center gap-0.5 font-bold', up ? 'text-success' : 'text-destructive')}>
        <Icon className="size-3.5" aria-hidden="true" />
        {up ? '+' : ''}
        {pct}%
      </span>
      {label}-тай харьцуулахад
    </span>
  )
}

function Kpi({ icon: Icon, label, value, children }: { icon: LucideIcon; label: string; value: string; children?: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-muted-foreground">{label}</p>
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/8 text-primary">
          <Icon className="size-4.5" aria-hidden="true" />
        </span>
      </div>
      <p className="text-3xl leading-none font-extrabold tracking-tight">{value}</p>
      {children}
    </Card>
  )
}

function StockRow({ alert }: { alert: StockAlert }) {
  const out = alert.stock <= 0
  return (
    <li>
      <Link href={`/admin/products/${alert.productId}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface md:px-6">
        <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-surface">
          <Image src={alert.image || PLACEHOLDER_IMAGE} alt="" fill sizes="40px" className="object-cover" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-bold">
            {alert.productName}
            {alert.size && <span className="text-muted-foreground"> · {alert.size} хэмжээ</span>}
          </span>
          <span className="text-xs text-muted-foreground">
            {out
              ? alert.stock < 0
                ? `Үлдэгдэл ${alert.stock} — тооллого хийж засна уу`
                : 'Дууссан — борлуулалтын цэг дээр сонгох боломжгүй'
              : `${alert.stock} ширхэг үлдсэн байна (хязгаар ${alert.threshold})`}
          </span>
        </span>
        <span
          className={cn(
            'flex min-w-12 flex-col items-center rounded-lg px-2 py-1 leading-tight',
            out ? 'bg-destructive/10 text-destructive' : 'bg-warning/20 text-warning-foreground',
          )}
        >
          <span className="text-lg font-extrabold">{alert.stock}</span>
          <span className="text-[10px] font-semibold">ш</span>
        </span>
      </Link>
    </li>
  )
}

type Attention = { tone: 'danger' | 'warning' | 'info'; icon: LucideIcon; title: string; text: string; action?: { href: string; label: string } }

const toneStyles: Record<Attention['tone'], { box: string; icon: string }> = {
  danger: { box: 'border-destructive/20 bg-destructive/5', icon: 'bg-destructive/10 text-destructive' },
  warning: { box: 'border-warning/50 bg-warning/10', icon: 'bg-warning/25 text-warning-foreground' },
  info: { box: 'border-border/80 bg-surface/70', icon: 'bg-primary/8 text-primary' },
}

export default async function DashboardPage() {
  const me = await requireAdmin()
  const d = await getDashboard()
  const stockIssues = d.outOfStock.length + d.lowStock.length

  const attention: Attention[] = []
  for (const admin of d.seedAdmins) {
    attention.push({
      tone: 'danger',
      icon: ShieldAlert,
      title: 'Анхны админы нууц үг солигдоогүй байна',
      text: `${admin.email} бүртгэл seed скриптийн нууц үгтэй хэвээр байна. Нэн даруй солино уу.`,
      action: { href: `/admin/users/${admin.id}/edit`, label: 'Нууц үг солих' },
    })
  }
  if (!d.paymentConfigured) {
    const keys = d.paymentSource === 'bonum' ? 'BONUM_TERMINAL_ID, BONUM_SECRET_KEY, BONUM_CHECKSUM_KEY' : 'QPAY_USER, QPAY_PASS, QPAY_INVOICE_CODE'
    attention.push({
      tone: 'warning',
      icon: CreditCard,
      title: `${PAYMENT_SOURCE_LABELS[d.paymentSource]} туршилтын горимд ажиллаж байна`,
      text: `.env дотор ${keys} тохируулаагүй тул төлбөр бодитоор авахгүй, 5 секундийн дараа автоматаар «төлөгдөнө».`,
    })
  }
  if (d.outOfStock.length > 0) {
    attention.push({
      tone: 'warning',
      icon: PackageX,
      title: `${d.outOfStock.length} хэмжээ дууссан байна`,
      text: 'Эдгээрийг борлуулалтын цэг дээр сонгох боломжгүй. Орлого авч нөхнө үү.',
      action: { href: '/admin/inventory?stock=out', label: 'Орлого авах' },
    })
  }
  if (d.stalePending > 0) {
    attention.push({
      tone: 'info',
      icon: Clock,
      title: `${d.stalePending} нэхэмжлэх төлөгдөөгүй үлдсэн`,
      text: '30 минутаас дээш төлөгдөөгүй нэхэмжлэх. Төлбөр орсон эсэхийг шалгах эсвэл цуцалж болно.',
      action: { href: '/admin/orders?status=pending&range=all', label: 'Шалгах' },
    })
  }
  if (!d.s3Configured) {
    attention.push({ tone: 'info', icon: ImageOff, title: 'Зураг байршуулах тохиргоо дутуу', text: 'S3 тохиргоо хийгдээгүй тул шинэ барааны зураг оруулах боломжгүй.' })
  }

  const avgOrder = d.month.orders ? Math.round(d.month.revenue / d.month.orders) : 0
  const urgent = attention.filter((a) => a.tone !== 'info').length

  return (
    <>
      <section className="relative isolate overflow-hidden rounded-3xl bg-primary-deep px-6 py-8 text-primary-foreground md:px-10 md:py-10">
        <div className="absolute inset-0 -z-10 bg-linear-to-br from-primary-deep via-primary to-primary-deep" aria-hidden="true" />
        <div className="absolute -top-24 -left-20 -z-10 size-72 rounded-full bg-highlight/25 blur-3xl" aria-hidden="true" />
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex max-w-xl flex-col gap-4">
            <p className="eyebrow flex items-center gap-3 text-highlight">
              <span className="h-px w-8 bg-highlight" aria-hidden="true" />
              {today.format(new Date())}
            </p>
            <h1 className="text-3xl leading-tight font-extrabold text-balance md:text-4xl">
              {greeting()}, <span className="text-highlight">{givenName(me.name)}</span>
            </h1>
            <p className="text-sm leading-relaxed text-primary-foreground/80 md:text-base">
              {stockIssues > 0
                ? `${stockIssues} хэмжээний үлдэгдэл дуусч байна. Доорх жагсаалтаас нөхөх барааг харна уу.`
                : 'Бүх барааны үлдэгдэл хангалттай байна.'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <AdminLink href="/" variant="primary">
                <Store aria-hidden="true" />
                Борлуулалт эхлүүлэх
              </AdminLink>
              <AdminLink href="/admin/inventory" variant="outline" className="border-white/25 bg-white/8 text-primary-foreground hover:border-white/50 hover:bg-white/15">
                <PackagePlus aria-hidden="true" />
                Орлого авах
              </AdminLink>
            </div>
          </div>
          <dl className="grid grid-cols-3 divide-x divide-white/10 overflow-hidden rounded-2xl border border-white/15 bg-white/8 backdrop-blur-sm lg:min-w-[24rem]">
            {[
              { label: 'Өнөөдрийн орлого', value: formatMNT(d.today.revenue) },
              { label: 'Захиалга', value: formatNumber(d.today.orders) },
              { label: 'Зарагдсан', value: `${formatNumber(d.today.items)} ш` },
            ].map((s) => (
              <div key={s.label} className="flex flex-col gap-1 px-4 py-4 md:px-5">
                <dt className="order-2 text-xs font-medium text-primary-foreground/65">{s.label}</dt>
                <dd className="order-1 truncate text-xl leading-none font-extrabold md:text-2xl">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {attention.length > 0 ? (
        <section aria-labelledby="attention-title">
          <Card>
            <CardHeader
              id="attention-title"
              title="Анхаарах зүйлс"
              action={<span className="rounded-full bg-primary/8 px-2.5 py-0.5 text-xs font-bold text-primary">{urgent || attention.length}</span>}
            />
            <ul className="grid gap-3 p-4 md:grid-cols-2 md:p-5">
              {attention.map(({ tone, icon: Icon, title, text, action }) => (
                <li key={title} className={cn('flex items-start gap-3 rounded-xl border p-4', toneStyles[tone].box, tone === 'danger' && 'md:col-span-2')}>
                  <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', toneStyles[tone].icon)}>
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="text-sm font-bold">{title}</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
                  </div>
                  {action && (
                    <AdminLink href={action.href} variant={tone === 'danger' ? 'brand' : 'outline'} size="sm" className="self-center">
                      {action.label}
                    </AdminLink>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : (
        <p role="status" className="flex items-center gap-3 rounded-2xl border border-success/25 bg-success/10 px-5 py-4 text-sm font-medium text-success">
          <CircleCheck className="size-5 shrink-0" aria-hidden="true" />
          Бүх зүйл хэвийн: үлдэгдэл хангалттай, төлбөр хүлээгдэж буй нэхэмжлэх алга.
        </p>
      )}

      <section aria-label="Гол үзүүлэлтүүд" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Wallet} label="Өнөөдрийн орлого" value={formatMNT(d.today.revenue)}>
          <Change now={d.today.revenue} before={d.yesterday.revenue} label="Өчигдөр" />
        </Kpi>
        <Kpi icon={ShoppingBag} label="Энэ сарын орлого" value={formatMNT(d.month.revenue)}>
          <Change now={d.month.revenue} before={d.lastMonth.revenue} label="Өмнөх сарын мөн үе" />
        </Kpi>
        <Kpi icon={CreditCard} label="Энэ сарын захиалга" value={formatNumber(d.month.orders)}>
          <span className="text-xs text-muted-foreground">
            {formatNumber(d.month.items)} ширхэг бараа · дундаж {formatMNT(avgOrder)}
          </span>
        </Kpi>
        <Kpi icon={Boxes} label="Агуулахын үлдэгдэл" value={`${formatNumber(d.inventory.units)} ш`}>
          <span className="text-xs text-muted-foreground">
            {formatMNT(d.inventory.value)} үнэлгээ · {d.inventory.active} бараа зарагдаж буй
          </span>
        </Kpi>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Өдөр тутмын орлого"
            description="Сүүлийн 14 хоног · төлөгдсөн захиалга"
            action={
              <Link href="/admin/orders?range=7d" className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                Захиалга <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            }
          />
          <div className="px-4 pt-10 pb-5 md:px-6">
            <SalesChart points={d.series} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Ангиллаар" description="Энэ сарын орлого" />
          <div className="p-5 md:p-6">
            {d.byCategory.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Энэ сард борлуулалт хийгдээгүй байна.</p>
            ) : (
              <BarList rows={d.byCategory.map((c) => ({ label: c.name, value: c.revenue, sub: `${c.qty} ш` }))} format={formatMNT} />
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            id="stock-title"
            title="Дуусч буй бараа"
            description="Хэмжээ тус бүрээр, хамгийн бага үлдэгдэлтэй нь эхэнд"
            action={
              <Link href="/admin/inventory?stock=low" className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                Агуулах <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            }
          />
          {stockIssues === 0 ? (
            <EmptyState icon={CircleCheck} title="Үлдэгдэл хангалттай" text="Хязгаараас доош орсон хэмжээ алга байна." />
          ) : (
            <ul aria-labelledby="stock-title" className="max-h-[26rem] divide-y divide-border/80 overflow-y-auto">
              {[...d.outOfStock, ...d.lowStock].slice(0, 30).map((alert) => (
                <StockRow key={`${alert.productId}-${alert.size}`} alert={alert} />
              ))}
            </ul>
          )}
          {stockIssues > 30 && <p className="border-t border-border/80 px-6 py-3 text-xs text-muted-foreground">Бусад {stockIssues - 30} хэмжээг агуулахаас харна уу.</p>}
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Их зарагдсан бараа" description="Сүүлийн 30 хоног" />
            {d.topProducts.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">Борлуулалт хийгдээгүй байна.</p>
            ) : (
              <ol className="divide-y divide-border/80">
                {d.topProducts.map((p, index) => (
                  <li key={p.productId}>
                    <Link href={`/admin/products/${p.productId}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface md:px-6">
                      <span className="w-4 text-sm font-bold text-muted-foreground">{index + 1}</span>
                      <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-surface">
                        <Image src={p.image || PLACEHOLDER_IMAGE} alt="" fill sizes="40px" className="object-cover" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-bold">{p.name}</span>
                        <span className="text-xs text-muted-foreground">{formatMNT(p.revenue)}</span>
                      </span>
                      <span className="text-sm font-bold">{p.qty} ш</span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {d.topSizes.length > 0 && (
            <Card>
              <CardHeader title="Их зарагддаг хэмжээ" description="Хувцас · сүүлийн 30 хоног — орлого авахдаа анхаарна уу" />
              <div className="p-5 md:p-6">
                <BarList rows={d.topSizes.map((s) => ({ label: `${s.size} хэмжээ`, value: s.qty }))} format={(v) => `${v} ш`} />
              </div>
            </Card>
          )}
        </div>
      </div>

      <Card>
        <CardHeader
          id="recent-title"
          title="Сүүлийн захиалгууд"
          action={
            <Link href="/admin/orders" className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              Бүгд <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          }
        />
        {d.recentOrders.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="Захиалга алга"
            text="Борлуулалтын цэгээс төлбөр авахад энд харагдана."
            action={
              <AdminLink href="/" variant="primary">
                <Plus aria-hidden="true" />
                Борлуулалт эхлүүлэх
              </AdminLink>
            }
          />
        ) : (
          <ul aria-labelledby="recent-title" className="divide-y divide-border/80">
            {d.recentOrders.map((order) => (
              <li key={order.id}>
                <Link href={`/admin/orders/${order.id}`} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface md:px-6">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-sm font-bold">
                      <span className="font-mono text-primary">{order.orderNo}</span>
                      {order.demo && <Badge className="px-1.5 py-0 text-[10px]">Туршилт</Badge>}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {timeAgo(order.createdAt, '')} · {order.summary}
                    </span>
                  </span>
                  <span className="text-sm font-bold">{formatMNT(order.total)}</span>
                  <span className="hidden sm:block">
                    <OrderStatusBadge status={order.status} createdAt={order.createdAt} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {d.inventory.products === 0 && (
        <Card className="flex items-center gap-4 p-5">
          <AlertTriangle className="size-5 text-warning-foreground" aria-hidden="true" />
          <p className="flex-1 text-sm">
            Бараа бүртгэгдээгүй байна. <code className="rounded bg-surface px-1.5 py-0.5">npm run seed</code> ажиллуулж анхны бараагаа оруулах эсвэл гараар нэмнэ үү.
          </p>
          <AdminLink href="/admin/products/new" variant="primary" size="sm">
            Бараа нэмэх
          </AdminLink>
        </Card>
      )}
    </>
  )
}
