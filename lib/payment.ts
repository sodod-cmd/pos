import 'server-only'
import { createBonumInvoice, isBonumConfigured } from '@/lib/bonum'
import { PAYMENT_SOURCES, type BankApp, type PaymentSource } from '@/lib/pos-types'
import { checkQpayPayment, createQpayInvoice, isQpayConfigured } from '@/lib/qpay'

/**
 * One place that knows which payment provider issues invoices. DEFAULT_PAYMENT_SOURCE
 * picks the provider (qpay | bonum); when that provider has no credentials the POS runs
 * in demo mode and an invoice "pays itself" after a few seconds.
 */

const FALLBACK_PAYMENT_SOURCE: PaymentSource = 'qpay'
const DEMO_PAYMENT_DELAY_MS = 5000

export function isPaymentSource(value: unknown): value is PaymentSource {
  return PAYMENT_SOURCES.includes(value as PaymentSource)
}

export function getDefaultPaymentSource(): PaymentSource {
  const value = process.env.DEFAULT_PAYMENT_SOURCE?.trim().toLowerCase()
  return isPaymentSource(value) ? value : FALLBACK_PAYMENT_SOURCE
}

export function isPaymentConfigured(source: PaymentSource = getDefaultPaymentSource()) {
  return source === 'bonum' ? isBonumConfigured() : isQpayConfigured()
}

export function isDemoInvoice(invoiceId: string) {
  return invoiceId.startsWith('DEMO-')
}

/** QPay sends bare base64 PNG; other providers may send a data URI or a URL. */
function toImageSrc(image?: string) {
  if (!image) return undefined
  return /^(data:|https?:\/\/)/i.test(image) ? image : `data:image/png;base64,${image}`
}

export type PaymentInvoice = {
  source: PaymentSource
  invoiceId: string
  qrText: string
  /** Ready to use as an <img src>. */
  qrImage?: string
  shortUrl?: string
  bankApps: BankApp[]
  demo: boolean
}

interface CreatePaymentInvoiceInput {
  orderNo: string
  amount: number
  description: string
  /** QPay calls this when the invoice is paid; Bonum uses the webhook set up for the terminal. */
  qpayCallbackUrl: string
}

export async function createPaymentInvoice(source: PaymentSource, input: CreatePaymentInvoiceInput): Promise<PaymentInvoice> {
  if (!isPaymentConfigured(source)) {
    const invoiceId = `DEMO-${Date.now()}-${input.amount}`
    return {
      source,
      invoiceId,
      qrText: `${source}-demo://pay/${invoiceId}`,
      // Harmless placeholder links so the app list can be tried out without credentials.
      bankApps: ['Khan bank', 'Golomt bank', 'TDB online', 'State bank', 'Xac bank', 'socialpay'].map(
        (name): BankApp => ({ name, description: name, link: `${source}-demo://pay/${invoiceId}` }),
      ),
      demo: true,
    }
  }

  const invoice =
    source === 'bonum'
      ? await createBonumInvoice({ orderNo: input.orderNo, amount: input.amount })
      : await createQpayInvoice({
          orderNo: input.orderNo,
          amount: input.amount,
          description: input.description,
          callbackUrl: input.qpayCallbackUrl,
        })

  return { ...invoice, source, qrImage: toImageSrc(invoice.qrImage), demo: false }
}

/**
 * Asks the provider whether an invoice is paid. Bonum cannot be asked: its payments
 * arrive through the webhook, which marks the order paid in the database directly.
 */
export async function checkInvoicePayment(source: PaymentSource, invoiceId: string) {
  if (isDemoInvoice(invoiceId)) {
    const match = /^DEMO-(\d+)-(\d+)$/.exec(invoiceId)
    if (!match) throw new Error('Нэхэмжлэх олдсонгүй')
    const [, createdAt, amount] = match
    const paid = Date.now() - Number(createdAt) >= DEMO_PAYMENT_DELAY_MS
    return { paid, paidAmount: paid ? Number(amount) : 0 }
  }
  if (source === 'bonum') return { paid: false, paidAmount: 0 }
  return checkQpayPayment(invoiceId)
}
