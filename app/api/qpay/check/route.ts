import { NextResponse } from 'next/server'
import { findOrderByInvoice, syncPayment } from '@/lib/orders'
import type { CheckResponse } from '@/lib/pos-types'

const INVOICE_ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/

export async function POST(request: Request) {
  let invoiceId: unknown
  try {
    ;({ invoiceId } = await request.json())
  } catch {
    return NextResponse.json({ error: 'Хүсэлт буруу байна' }, { status: 400 })
  }

  if (typeof invoiceId !== 'string' || !INVOICE_ID_PATTERN.test(invoiceId)) {
    return NextResponse.json({ error: 'Нэхэмжлэхийн дугаар буруу байна' }, { status: 400 })
  }

  try {
    // Only invoices this POS issued can be checked, and a paid one is recorded exactly once.
    const order = await findOrderByInvoice(invoiceId)
    if (!order) return NextResponse.json({ error: 'Нэхэмжлэх олдсонгүй' }, { status: 404 })
    // A cancelled order is still checked: a parent may have paid after the cashier cancelled.
    const { paid, paidAmount } = await syncPayment(order)
    if (!paid && order.status === 'cancelled') {
      return NextResponse.json({ error: 'Энэ захиалга цуцлагдсан байна' }, { status: 409 })
    }
    const result: CheckResponse = { paid, paidAmount }
    return NextResponse.json(result)
  } catch (error) {
    console.error('[qpay] Check error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Төлбөр шалгаж чадсангүй' }, { status: 502 })
  }
}
