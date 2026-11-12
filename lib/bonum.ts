import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { BankApp } from '@/lib/pos-types'

/**
 * Bonum (mPay) QR payments. Bonum has no "is this invoice paid" call in our integration:
 * it reports payments to the webhook registered for the terminal (/api/bonum/webhook),
 * which records the payment on the order.
 */

const BASE_URL = () => (process.env.BONUM_BASE_URL || 'https://apis.bonum.mn').replace(/\/+$/, '')
const terminalId = () => process.env.BONUM_TERMINAL_ID ?? ''
const secretKey = () => process.env.BONUM_SECRET_KEY ?? ''
const checksumKey = () => process.env.BONUM_CHECKSUM_KEY ?? ''

const QR_EXPIRES_IN_SECONDS = 600
// Asking Bonum for a new token on every request gets rate limited (429).
const TOKEN_EXPIRY_SKEW_MS = 60_000

export const BONUM_CHECKSUM_HEADER = 'x-checksum-v2'

export function isBonumConfigured() {
  return Boolean(terminalId() && secretKey() && checksumKey())
}

class BonumHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

let tokenCache: { token: string; expiresAt: number } | null = null

async function getToken() {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token

  const res = await fetch(`${BASE_URL()}/bonum-gateway/ecommerce/auth/create`, {
    method: 'GET',
    headers: { Authorization: `AppSecret ${secretKey()}`, 'X-TERMINAL-ID': terminalId() },
    cache: 'no-store',
  })
  if (!res.ok) throw new BonumHttpError(`Bonum нэвтрэлт амжилтгүй боллоо (${res.status})`, res.status)

  const data = (await res.json()) as { accessToken?: string; expiresIn?: number }
  if (!data.accessToken) throw new Error('Bonum token ирсэнгүй')
  tokenCache = {
    token: data.accessToken,
    expiresAt: Date.now() + (data.expiresIn ?? 0) * 1000 - TOKEN_EXPIRY_SKEW_MS,
  }
  return data.accessToken
}

/** Runs a request with a cached token, fetching a fresh one once if Bonum rejects it. */
async function withToken<T>(request: (token: string) => Promise<T>): Promise<T> {
  try {
    return await request(await getToken())
  } catch (error) {
    if (!(error instanceof BonumHttpError) || error.status !== 401) throw error
    tokenCache = null
    return request(await getToken())
  }
}

type BonumQrInvoice = {
  invoiceId: string
  qrCode: string
  qrImage?: string
  links?: { name?: string; description?: string; logo?: string; link?: string }[]
}

export async function createBonumInvoice(input: { orderNo: string; amount: number }) {
  const data = await withToken(async (token) => {
    const res = await fetch(`${BASE_URL()}/mpay-service/merchant/transaction/qr/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': 'mn',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount: input.amount,
        // Echoed back in the webhook, so the order number identifies the order there.
        transactionId: input.orderNo,
        expiresIn: QR_EXPIRES_IN_SECONDS,
      }),
      cache: 'no-store',
    })
    if (!res.ok) throw new BonumHttpError(`Bonum хүсэлт амжилтгүй боллоо (${res.status})`, res.status)
    const body = (await res.json()) as { status?: number; data?: BonumQrInvoice }
    if (body.status !== 200 || !body.data) throw new Error(`Bonum QR үүсгэж чадсангүй (${body.status})`)
    return body.data
  })

  return {
    invoiceId: data.invoiceId,
    qrText: data.qrCode,
    qrImage: data.qrImage,
    bankApps: (data.links ?? [])
      .filter((link) => link.link && link.name)
      .map((link): BankApp => ({
        name: link.name!,
        description: link.description || link.name!,
        logo: link.logo || undefined,
        link: link.link!,
      })),
  }
}

/** Checks the HMAC-SHA256 of the raw webhook body against Bonum's checksum header. */
export function isValidBonumChecksum(rawBody: string, checksum: string | null) {
  if (!checksum || !checksumKey()) return false
  const expected = Buffer.from(createHmac('sha256', checksumKey()).update(rawBody).digest('hex'), 'utf8')
  const received = Buffer.from(checksum.trim().toLowerCase(), 'utf8')
  return received.length === expected.length && timingSafeEqual(received, expected)
}

export type BonumWebhook = {
  type?: 'PAYMENT' | 'CARD-TOKEN' | 'SUBSCRIPTION-PAYMENT'
  status?: 'SUCCESS' | 'FAILED'
  message?: string
  body?: {
    amount?: number
    currency?: string
    completedAt?: string
    terminalId?: string
    invoiceId?: string
    paymentVendor?: string
    status?: string
    transactionId?: string
  }
}
