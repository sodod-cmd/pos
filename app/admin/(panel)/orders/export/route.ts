import { getCurrentAdmin } from '@/lib/auth/session'
import { ORDER_STATUS_LABELS, exportOrders, isOrderRange, isOrderStatus } from '@/lib/orders'
import { TIME_ZONE } from '@/lib/time'

const stamp = new Intl.DateTimeFormat('sv-SE', { timeZone: TIME_ZONE, dateStyle: 'short', timeStyle: 'short' })

function cell(value: string | number) {
  const text = String(value)
  // Quote everything that could break a row, and defuse spreadsheet formulas.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
  return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** One row per order line, so a spreadsheet can sum by product, size or day. */
export async function GET(request: Request) {
  if (!(await getCurrentAdmin())) return new Response('Unauthorized', { status: 401 })
  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  const range = url.searchParams.get('range')
  const q = url.searchParams.get('q')?.slice(0, 60) || undefined

  const orders = await exportOrders({ status: isOrderStatus(status) ? status : undefined, range: isOrderRange(range) ? range : '30d', q })
  const header = ['Захиалгын дугаар', 'Төлөв', 'Үүсгэсэн', 'Төлсөн', 'Сурагчийн нэр', 'Анги', 'Сурагчийн код', 'Бараа', 'Ангилал', 'Хэмжээ', 'Нэгж үнэ', 'Тоо', 'Дүн', 'Захиалгын нийт', 'Туршилт']
  const rows = orders.flatMap((order) =>
    order.items.map((item) => [
      order.orderNo,
      ORDER_STATUS_LABELS[order.status],
      stamp.format(order.createdAt),
      order.paidAt ? stamp.format(order.paidAt) : '',
      order.student?.studentName ?? '',
      order.student?.className ?? '',
      order.student?.studentCode ?? '',
      item.name,
      item.categoryName,
      item.size,
      item.price,
      item.qty,
      item.lineTotal,
      order.total,
      order.demo ? 'Тийм' : '',
    ]),
  )
  // BOM so Excel opens the Cyrillic text as UTF-8.
  const csv = '﻿' + [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n')
  const day = stamp.format(new Date()).slice(0, 10)
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="orders-${day}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
