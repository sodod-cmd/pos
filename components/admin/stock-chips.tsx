import { stockStatus } from '@/lib/catalog-status'
import { cn } from '@/lib/utils'

/** One small cell per size, coloured by how much is left. */
export function StockChips({
  variants,
  threshold,
  limit,
}: {
  variants: { size: string; stock: number }[]
  threshold: number
  limit?: number
}) {
  const shown = limit ? variants.slice(0, limit) : variants
  return (
    <ul className="flex flex-wrap gap-1">
      {shown.map((variant) => {
        const status = stockStatus(variant.stock, threshold)
        return (
          <li
            key={variant.size}
            title={`${variant.size || 'Үлдэгдэл'}: ${variant.stock} ширхэг`}
            className={cn(
              'flex min-w-11 flex-col items-center rounded-md border px-1.5 py-0.5 leading-tight',
              status === 'out' && 'border-destructive/30 bg-destructive/8 text-destructive',
              status === 'low' && 'border-warning/60 bg-warning/15 text-warning-foreground',
              status === 'ok' && 'border-border bg-card text-foreground',
            )}
          >
            {variant.size && <span className="text-[10px] font-medium opacity-75">{variant.size}</span>}
            <span className="text-xs font-bold">{variant.stock}</span>
          </li>
        )
      })}
      {limit && variants.length > limit && <li className="self-center px-1 text-xs text-muted-foreground">+{variants.length - limit}</li>}
    </ul>
  )
}
