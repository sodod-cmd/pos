import { NextResponse } from 'next/server'
import { findOrderByNo, syncPayment } from '@/lib/orders'

/**
 * QPay calls this when an invoice is paid. The notification itself is not trusted:
 * the order's invoice is checked with QPay before anything is recorded.
 */
async function handle(request: Request) {
  const orderNo = new URL(request.url).searchParams.get('order')
  if (orderNo && /^[A-Z0-9-]{4,40}$/.test(orderNo)) {
    try {
      const order = await findOrderByNo(orderNo)
      if (order) await syncPayment(order)
    } catch (error) {
      console.error('[qpay] Callback error:', error instanceof Error ? error.message : error)
    }
  }
  return NextResponse.json({ ok: true })
}

export const GET = handle
export const POST = handle
