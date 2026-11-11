import { formatMNT } from '@/lib/products'
import { TIME_ZONE } from '@/lib/time'
import { cn } from '@/lib/utils'

const dayLabel = new Intl.DateTimeFormat('mn-MN', { timeZone: TIME_ZONE, month: 'numeric', day: 'numeric' })
const weekday = new Intl.DateTimeFormat('mn-MN', { timeZone: TIME_ZONE, weekday: 'short' })

/** "1.2 сая" / "350 мян" for axis labels; tooltips show the exact amount. */
function compact(amount: number) {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 1)} сая`
  if (amount >= 1_000) return `${Math.round(amount / 1_000)} мян`
  return String(amount)
}

/** A rounded ceiling so the axis reads 0 / half / top with tidy numbers. */
function niceMax(value: number) {
  if (value <= 0) return 100_000
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value) ?? 10
  return step * magnitude
}

/**
 * Daily revenue as one bar per day. Single series in the brand colour, recessive grid,
 * a hover/focus tooltip per bar, and the same numbers as a table for screen readers.
 */
export function SalesChart({ points }: { points: { day: string; date: Date; revenue: number; orders: number }[] }) {
  const max = niceMax(Math.max(...points.map((p) => p.revenue)))
  const ticks = [max, max / 2, 0]
  const lastIndex = points.length - 1

  return (
    <figure className="flex flex-col gap-3">
      <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-2" aria-hidden="true">
        <div className="relative h-48">
          {ticks.map((tick, i) => (
            <span key={tick} className="absolute right-0 -translate-y-1/2 text-[11px] text-muted-foreground" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}>
              {compact(tick)}
            </span>
          ))}
        </div>
        <div className="relative h-48">
          {ticks.map((tick, i) => (
            <span
              key={tick}
              className={cn('absolute inset-x-0 border-t', i === ticks.length - 1 ? 'border-border' : 'border-dashed border-border/60')}
              style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
            />
          ))}
          <ol className="absolute inset-0 flex items-end gap-0.5">
            {points.map((point, index) => {
              const height = (point.revenue / max) * 100
              const isToday = index === lastIndex
              return (
                <li key={point.day} className="group relative flex h-full flex-1 items-end justify-center" tabIndex={0}>
                  <span
                    className={cn(
                      'w-full max-w-7 rounded-t-[4px] transition-colors',
                      point.revenue > 0 ? (isToday ? 'bg-primary' : 'bg-primary/70 group-hover:bg-primary group-focus:bg-primary') : 'bg-border',
                    )}
                    style={{ height: point.revenue > 0 ? `max(${height}%, 3px)` : '2px' }}
                  />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-max -translate-x-1/2 flex-col rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg group-hover:flex group-focus:flex">
                    <span className="font-semibold text-muted-foreground">
                      {dayLabel.format(point.date)} · {weekday.format(point.date)}
                    </span>
                    <span className="text-sm font-bold text-foreground">{formatMNT(point.revenue)}</span>
                    <span className="text-muted-foreground">{point.orders} захиалга</span>
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
        <span />
        <ol className="flex gap-0.5">
          {points.map((point, index) => (
            <li key={point.day} className={cn('flex-1 text-center text-[10px] text-muted-foreground', index % 2 === 1 && index !== lastIndex && 'max-sm:invisible')}>
              {index === lastIndex ? 'Өнөөдөр' : dayLabel.format(point.date)}
            </li>
          ))}
        </ol>
      </div>
      <table className="sr-only">
        <caption>Сүүлийн {points.length} хоногийн өдөр тутмын орлого</caption>
        <thead>
          <tr>
            <th>Өдөр</th>
            <th>Орлого</th>
            <th>Захиалга</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.day}>
              <td>{point.day}</td>
              <td>{formatMNT(point.revenue)}</td>
              <td>{point.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

/** Horizontal magnitude bars with the value as text beside them (never colour alone). */
export function BarList({ rows, format }: { rows: { label: string; value: number; sub?: string }[]; format: (value: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.label} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-semibold">{row.label}</span>
            <span className="shrink-0 font-bold">
              {format(row.value)}
              {row.sub && <span className="ml-1.5 text-xs font-medium text-muted-foreground">{row.sub}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface" aria-hidden="true">
            <div className="h-full rounded-full bg-primary/75" style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
