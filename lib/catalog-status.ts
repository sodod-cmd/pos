// Client-safe copy of the stock rule in lib/catalog.ts, for components that render on both sides.
export type StockStatus = 'out' | 'low' | 'ok'

export function stockStatus(stock: number, threshold: number): StockStatus {
  if (stock <= 0) return 'out'
  if (stock <= threshold) return 'low'
  return 'ok'
}

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  out: 'Дууссан',
  low: 'Дуусч байна',
  ok: 'Хангалттай',
}
