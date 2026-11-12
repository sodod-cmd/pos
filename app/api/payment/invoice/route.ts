import { NextResponse } from 'next/server'
import { attachInvoice, createPendingOrder, discardOrder, priceCart } from '@/lib/orders'
import { createPaymentInvoice, getDefaultPaymentSource } from '@/lib/payment'
import { SCHOOL_NAME } from '@/lib/school'
import { PAYMENT_SOURCE_LABELS, cleanStudentInfo, formatStudent, type InvoiceResponse } from '@/lib/pos-types'

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export async function POST(request: Request) {
  let body: { items?: unknown; student?: unknown }
  try {
    body = await request.json()
  } catch {
    return badRequest('Хүсэлт буруу байна')
  }

  const student = cleanStudentInfo(body.student)
  let priced: Awaited<ReturnType<typeof priceCart>>
  let orderNo: string
  try {
    priced = await priceCart(body.items)
    if (priced.error !== undefined) return badRequest(priced.error)
    orderNo = await createPendingOrder(priced, student)
  } catch (error) {
    console.error('[payment] Order could not be created:', error)
    return NextResponse.json({ error: 'Захиалга үүсгэж чадсангүй. Түр хүлээгээд дахин оролдоно уу.' }, { status: 503 })
  }

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const protocol = request.headers.get('x-forwarded-proto') ?? 'https'
  const callbackBase = process.env.QPAY_CALLBACK_URL ?? `${protocol}://${host}/api/qpay/callback`

  const source = getDefaultPaymentSource()
  try {
    const invoice = await createPaymentInvoice(source, {
      orderNo,
      amount: priced.total,
      // The student's name helps the parent and the accountant match the bank statement line.
      description: `${SCHOOL_NAME}: ${student ? `${formatStudent(student)} — ` : ''}${priced.description}`.slice(0, 255),
      qpayCallbackUrl: `${callbackBase}?order=${encodeURIComponent(orderNo)}`,
    })
    await attachInvoice(orderNo, invoice)
    const response: InvoiceResponse = { ...invoice, orderNo, amount: priced.total }
    return NextResponse.json(response)
  } catch (error) {
    console.error(`[payment] ${source} invoice error:`, error instanceof Error ? error.message : error)
    await discardOrder(orderNo).catch(() => {})
    return NextResponse.json({ error: `${PAYMENT_SOURCE_LABELS[source]} нэхэмжлэх үүсгэж чадсангүй` }, { status: 502 })
  }
}
