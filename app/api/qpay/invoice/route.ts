import { NextResponse } from 'next/server'
import { attachInvoice, createPendingOrder, discardOrder, priceCart } from '@/lib/orders'
import { createInvoice } from '@/lib/qpay'
import { SCHOOL_NAME } from '@/lib/school'
import { cleanStudentInfo, formatStudent, type InvoiceResponse } from '@/lib/pos-types'

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
    console.error('[qpay] Order could not be created:', error)
    return NextResponse.json({ error: 'Захиалга үүсгэж чадсангүй. Түр хүлээгээд дахин оролдоно уу.' }, { status: 503 })
  }

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const protocol = request.headers.get('x-forwarded-proto') ?? 'https'
  const callbackBase = process.env.QPAY_CALLBACK_URL ?? `${protocol}://${host}/api/qpay/callback`

  try {
    const invoice = await createInvoice({
      orderNo,
      amount: priced.total,
      // The student's name helps the parent and the accountant match the bank statement line.
      description: `${SCHOOL_NAME}: ${student ? `${formatStudent(student)} — ` : ''}${priced.description}`.slice(0, 255),
      callbackUrl: `${callbackBase}?order=${encodeURIComponent(orderNo)}`,
    })
    await attachInvoice(orderNo, invoice.invoiceId, invoice.demo)
    const response: InvoiceResponse = { ...invoice, orderNo, amount: priced.total }
    return NextResponse.json(response)
  } catch (error) {
    console.error('[qpay] Invoice error:', error instanceof Error ? error.message : error)
    await discardOrder(orderNo).catch(() => {})
    return NextResponse.json({ error: 'QPay нэхэмжлэх үүсгэж чадсангүй' }, { status: 502 })
  }
}
