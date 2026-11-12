import 'server-only'
import type { BankApp } from '@/lib/pos-types'

const BASE_URL = process.env.QPAY_BASE_URL ?? 'https://merchant.qpay.mn/v2'

// .env uses QPAY_USER / QPAY_PASS; the longer names are still accepted.
const qpayUser = () => process.env.QPAY_USER || process.env.QPAY_USERNAME
const qpayPass = () => process.env.QPAY_PASS || process.env.QPAY_PASSWORD

export function isQpayConfigured() {
  return Boolean(qpayUser() && qpayPass() && process.env.QPAY_INVOICE_CODE)
}

let tokenCache: { token: string; expiresAt: number } | null = null

async function getToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.token

  const credentials = Buffer.from(
    `${qpayUser()}:${qpayPass()}`,
  ).toString('base64')

  const res = await fetch(`${BASE_URL}/auth/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('QPay нэвтрэлт амжилтгүй боллоо')

  const data = (await res.json()) as { access_token: string; expires_in: number }
  // QPay returns expires_in as a unix timestamp (seconds); fall back to a relative TTL.
  const expiresAt =
    data.expires_in > 1e9 ? data.expires_in * 1000 : Date.now() + data.expires_in * 1000
  tokenCache = { token: data.access_token, expiresAt }
  return data.access_token
}

async function qpayFetch<T>(path: string, body: unknown): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`QPay хүсэлт амжилтгүй боллоо (${res.status})`)
  return (await res.json()) as T
}

interface CreateInvoiceInput {
  orderNo: string
  amount: number
  description: string
  callbackUrl: string
}

export async function createQpayInvoice(input: CreateInvoiceInput) {
  const data = await qpayFetch<{
    invoice_id: string
    qr_text: string
    qr_image?: string
    qPay_shortUrl?: string
    urls?: { name?: string; description?: string; logo?: string; link?: string }[]
  }>('/invoice', {
    invoice_code: process.env.QPAY_INVOICE_CODE,
    sender_invoice_no: input.orderNo,
    invoice_receiver_code: 'terminal',
    invoice_description: input.description,
    amount: input.amount,
    callback_url: input.callbackUrl,
  })

  return {
    invoiceId: data.invoice_id,
    qrText: data.qr_text,
    qrImage: data.qr_image,
    shortUrl: data.qPay_shortUrl,
    bankApps: (data.urls ?? [])
      .filter((url) => url.link && url.name)
      .map((url): BankApp => ({
        name: url.name!,
        description: url.description || url.name!,
        logo: url.logo || undefined,
        link: url.link!,
      })),
  }
}

export async function checkQpayPayment(invoiceId: string) {
  const data = await qpayFetch<{
    count: number
    paid_amount?: number
    rows?: { payment_status: string; payment_amount?: string | number }[]
  }>('/payment/check', {
    object_type: 'INVOICE',
    object_id: invoiceId,
    offset: { page_number: 1, page_limit: 100 },
  })

  const paidRows = (data.rows ?? []).filter((row) => row.payment_status === 'PAID')
  const paidAmount =
    data.paid_amount ?? paidRows.reduce((sum, row) => sum + Number(row.payment_amount ?? 0), 0)
  return { paid: paidRows.length > 0, paidAmount }
}
