import { NextResponse } from 'next/server'
import { BONUM_CHECKSUM_HEADER, isValidBonumChecksum, type BonumWebhook } from '@/lib/bonum'
import { recordProviderPayment } from '@/lib/orders'

/**
 * Bonum posts payment results here (register https://<domain>/api/bonum/webhook for the
 * terminal). The body is signed: HMAC-SHA256 of the raw body with BONUM_CHECKSUM_KEY.
 * Anything we do not act on still gets a 200 so Bonum does not keep retrying it.
 */

function skip(message: string) {
  console.warn(`[bonum] Webhook skipped: ${message}`)
  return NextResponse.json({ success: true })
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  // Seeing this line in the server log proves Bonum reaches this URL at all.
  console.info(`[bonum] Webhook received (${rawBody.length} bytes)`)

  if (!isValidBonumChecksum(rawBody, request.headers.get(BONUM_CHECKSUM_HEADER))) {
    console.warn('[bonum] Webhook checksum mismatch')
    return NextResponse.json({ success: false, error: 'Invalid checksum' }, { status: 401 })
  }

  let payload: BonumWebhook
  try {
    payload = JSON.parse(rawBody) as BonumWebhook
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { type, status, body } = payload
  if (type !== 'PAYMENT') return skip(`${type} төрлийг дэмжихгүй`)
  if (status !== 'SUCCESS') return skip(`${body?.transactionId}: төлбөр амжилтгүй (${payload.message ?? status})`)

  const orderNo = body?.transactionId
  if (!orderNo) return skip('transactionId алга')

  const terminalId = process.env.BONUM_TERMINAL_ID
  if (terminalId && body.terminalId && String(body.terminalId) !== terminalId) {
    return skip(`${orderNo}: өөр терминалын гүйлгээ (${body.terminalId})`)
  }

  try {
    const result = await recordProviderPayment({
      source: 'bonum',
      orderNo,
      invoiceId: body.invoiceId,
      paidAmount: Number(body.amount ?? 0),
    })
    if (result === 'not-found') return skip(`${orderNo} захиалга олдсонгүй`)
    if (result === 'already-paid') return skip(`${orderNo} аль хэдийн төлөгдсөн`)
    console.info(`[bonum] ${orderNo} төлөгдлөө`)
    return NextResponse.json({ success: true })
  } catch (error) {
    // A 5xx lets Bonum retry once the database is reachable again.
    console.error('[bonum] Webhook error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
