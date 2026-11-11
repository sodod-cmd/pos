export interface InvoiceResponse {
  invoiceId: string
  orderNo: string
  amount: number
  qrText: string
  qrImage?: string
  shortUrl?: string
  demo: boolean
}

export interface CheckResponse {
  paid: boolean
  paidAmount: number
}

export interface OrderItemInput {
  productId: string
  size?: string
  qty: number
}

/** Optional details the cashier can record with a sale, e.g. who the uniform is for. */
export interface StudentInfo {
  studentName?: string
  className?: string
  studentCode?: string
}

export const STUDENT_FIELD_LIMITS = { studentName: 80, className: 20, studentCode: 30 } as const

/** Trims, drops control characters and empty fields. Returns undefined when nothing was entered. */
export function cleanStudentInfo(raw: unknown): StudentInfo | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const result: StudentInfo = {}
  for (const key of Object.keys(STUDENT_FIELD_LIMITS) as (keyof StudentInfo)[]) {
    const value = (raw as Record<string, unknown>)[key]
    if (typeof value !== 'string') continue
    const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, STUDENT_FIELD_LIMITS[key])
    if (text) result[key] = text
  }
  return Object.keys(result).length ? result : undefined
}

/** "Б. Бат · 5А · S1234" */
export function formatStudent(info?: StudentInfo) {
  if (!info) return ''
  return [info.studentName, info.className, info.studentCode].filter(Boolean).join(' · ')
}
