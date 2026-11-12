'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { CheckCircle2, ChevronDown, GraduationCap, Landmark, Loader2, RefreshCw, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatMNT } from '@/lib/products'
import { PAYMENT_SOURCE_LABELS, STUDENT_FIELD_LIMITS, cleanStudentInfo, formatStudent, type BankApp, type CheckResponse, type InvoiceResponse, type StudentInfo } from '@/lib/pos-types'
import { cn } from '@/lib/utils'
import { useCart, type CartLine } from './cart-context'

type Step =
  | { kind: 'review' }
  | { kind: 'pay'; invoice: InvoiceResponse; lines: CartLine[]; student?: StudentInfo }
  | { kind: 'paid'; invoice: InvoiceResponse; lines: CartLine[]; student?: StudentInfo; paidAmount: number }

const EMPTY_STUDENT = { studentName: '', className: '', studentCode: '' }
// While the QR is on screen the payment is checked in the background, so a payment that
// lands (QPay callback, Bonum webhook) shows up without the cashier pressing anything.
const AUTO_CHECK_INTERVAL_MS = 3000

const STUDENT_FIELDS = [
  { key: 'studentName', label: 'Сурагчийн нэр', placeholder: 'Б. Бат-Эрдэнэ', autoComplete: 'off', span: true },
  { key: 'className', label: 'Анги', placeholder: '5А', autoComplete: 'off', span: false },
  { key: 'studentCode', label: 'Сурагчийн код', placeholder: 'S2024-015', autoComplete: 'off', span: false },
] as const

function StudentSummary({ student }: { student?: StudentInfo }) {
  if (!student) return null
  return (
    <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <GraduationCap aria-hidden="true" className="size-4 shrink-0" />
      <span className="sr-only">Сурагч: </span>
      {formatStudent(student)}
    </p>
  )
}

function BankAppList({ apps, open, onToggle }: { apps: BankApp[]; open: boolean; onToggle: () => void }) {
  if (apps.length === 0) return null
  return (
    <div className="rounded-xl border border-border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="bank-apps"
        className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm"
      >
        <Smartphone aria-hidden="true" className="size-4 shrink-0 text-primary" />
        <span className="flex-1 font-medium">
          Аппаар төлөх <span className="font-normal text-muted-foreground">({apps.length} банк)</span>
        </span>
        <ChevronDown aria-hidden="true" className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div id="bank-apps" className="border-t border-border p-3">
          <p className="mb-3 text-xs text-muted-foreground">Энэ төхөөрөмж дээр суулгасан банкны аппаа сонгоход төлбөрийн цонх шууд нээгдэнэ.</p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {apps.map((app) => (
              <li key={`${app.name}-${app.link}`}>
                <a
                  href={app.link}
                  className="flex h-full flex-col items-center gap-1.5 rounded-lg border border-border bg-card p-2 text-center transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {app.logo ? (
                    // Logos are hosted by the payment provider
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={app.logo} alt="" loading="lazy" className="size-10 rounded-lg object-contain" />
                  ) : (
                    <span className="flex size-10 items-center justify-center rounded-lg bg-muted">
                      <Landmark aria-hidden="true" className="size-5 text-muted-foreground" />
                    </span>
                  )}
                  <span className="line-clamp-2 text-[11px] leading-tight font-medium">{app.description}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

interface CheckoutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Provider chosen by DEFAULT_PAYMENT_SOURCE, shown on the button before an invoice exists. */
  paymentLabel?: string
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Алдаа гарлаа')
  return data as T
}

export function CheckoutDialog({ open, onOpenChange, paymentLabel = 'QPay' }: CheckoutDialogProps) {
  const { lines, total, clear } = useCart()
  const router = useRouter()
  const [step, setStep] = useState<Step>({ kind: 'review' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [student, setStudent] = useState(EMPTY_STUDENT)
  const [studentOpen, setStudentOpen] = useState(false)
  const [appsOpen, setAppsOpen] = useState(false)
  const studentFilled = Object.values(student).some((value) => value.trim() !== '')

  function handleOpenChange(next: boolean) {
    if (!next) {
      if (step.kind === 'paid') {
        clear()
        setStudent(EMPTY_STUDENT)
        setStudentOpen(false)
        // Pick up the stock this sale just used.
        router.refresh()
      }
      setStep({ kind: 'review' })
      setError(null)
      setNotice(null)
    }
    onOpenChange(next)
  }

  async function createInvoice() {
    setBusy(true)
    setError(null)
    try {
      const info = cleanStudentInfo(student)
      const invoice = await postJson<InvoiceResponse>('/api/payment/invoice', {
        items: lines.map(({ productId, size, qty }) => ({ productId, size, qty })),
        student: info,
      })
      setAppsOpen(false)
      setStep({ kind: 'pay', invoice, lines, student: info })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Алдаа гарлаа')
      // Stock may have changed since the page loaded (another sale, an admin edit).
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const checking = useRef(false)
  const payInvoiceId = step.kind === 'pay' ? step.invoice.invoiceId : null

  const checkPayment = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (step.kind !== 'pay' || checking.current) return
      checking.current = true
      if (!silent) {
        setBusy(true)
        setError(null)
        setNotice(null)
      }
      try {
        const result = await postJson<CheckResponse>('/api/payment/check', {
          invoiceId: step.invoice.invoiceId,
        })
        if (result.paid) {
          setNotice(null)
          setError(null)
          setStep({ ...step, kind: 'paid', paidAmount: result.paidAmount })
        } else if (!silent) {
          setNotice('Төлбөр хараахан баталгаажаагүй байна. Төлбөр орсон даруйд энэ цонх автоматаар шинэчлэгдэнэ.')
        }
      } catch (err) {
        if (!silent) setError(err instanceof Error ? err.message : 'Алдаа гарлаа')
      } finally {
        checking.current = false
        if (!silent) setBusy(false)
      }
    },
    [step],
  )

  const checkRef = useRef(checkPayment)
  useEffect(() => {
    checkRef.current = checkPayment
  }, [checkPayment])

  useEffect(() => {
    if (!open || !payInvoiceId) return
    const tick = () => void checkRef.current({ silent: true })
    const timer = window.setInterval(tick, AUTO_CHECK_INTERVAL_MS)
    // Coming back from a bank app (deeplink) or another tab: check right away.
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', tick)
    }
  }, [open, payInvoiceId])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] gap-5 overflow-y-auto p-5 sm:max-w-md">
        {step.kind === 'review' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg">Захиалга баталгаажуулах</DialogTitle>
              <DialogDescription>
                Захиалгаа шалгаад {paymentLabel} нэхэмжлэх үүсгэнэ үү.
              </DialogDescription>
            </DialogHeader>
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {lines.map((line) => (
                <li key={line.key} className="flex items-start justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{line.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {line.size ? `Хэмжээ ${line.size} · ` : ''}
                      {formatMNT(line.product.price)} × {line.qty}
                    </p>
                  </div>
                  <p className="font-semibold">{formatMNT(line.lineTotal)}</p>
                </li>
              ))}
            </ul>
            <div className="rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setStudentOpen((value) => !value)}
                aria-expanded={studentOpen}
                aria-controls="student-fields"
                className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm"
              >
                <GraduationCap aria-hidden="true" className="size-4 shrink-0 text-primary" />
                <span className="flex-1 font-medium">
                  Сурагчийн мэдээлэл <span className="font-normal text-muted-foreground">(заавал биш)</span>
                </span>
                {!studentOpen && studentFilled && (
                  <span className="max-w-[45%] truncate text-xs text-muted-foreground">{formatStudent(cleanStudentInfo(student))}</span>
                )}
                <ChevronDown aria-hidden="true" className={cn('size-4 shrink-0 text-muted-foreground transition-transform', studentOpen && 'rotate-180')} />
              </button>
              {studentOpen && (
                <div id="student-fields" className="grid grid-cols-2 gap-3 border-t border-border p-3">
                  {STUDENT_FIELDS.map((field) => (
                    <label key={field.key} className={cn('flex flex-col gap-1.5 text-xs font-medium text-muted-foreground', field.span && 'col-span-2')}>
                      {field.label}
                      <Input
                        value={student[field.key]}
                        onChange={(event) => setStudent((current) => ({ ...current, [field.key]: event.target.value.slice(0, STUDENT_FIELD_LIMITS[field.key]) }))}
                        placeholder={field.placeholder}
                        autoComplete={field.autoComplete}
                        className="h-10 bg-card text-sm text-foreground"
                      />
                    </label>
                  ))}
                  <p className="col-span-2 text-xs text-muted-foreground">Захиалгын түүхэнд хадгалагдаж, админаас нэр, анги, кодоор хайж болно.</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Нийт дүн</span>
              <span className="text-2xl font-bold text-primary">{formatMNT(total)}</span>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button onClick={createInvoice} disabled={busy || lines.length === 0} className="h-12 text-base">
              {busy && <Loader2 aria-hidden="true" className="animate-spin" />}
              {paymentLabel}-ээр төлөх
            </Button>
          </>
        )}

        {step.kind === 'pay' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg">{PAYMENT_SOURCE_LABELS[step.invoice.source]}-ээр төлбөр төлөх</DialogTitle>
              <DialogDescription>
                Эцэг эх банкны аппаар QR кодыг уншуулж, эсвэл «Аппаар төлөх» хэсгээс банкаа сонгож төлнө. Төлсний дараа «Төлбөр шалгах» товчийг дарна уу.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/50 p-5">
              <div className="rounded-xl bg-card p-3 shadow-sm">
                {step.invoice.qrImage ? (
                  // The server hands over a ready-to-use data URI or URL
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={step.invoice.qrImage}
                    alt={`${PAYMENT_SOURCE_LABELS[step.invoice.source]} төлбөрийн QR код`}
                    className="size-56"
                  />
                ) : (
                  <QRCodeSVG
                    value={step.invoice.qrText}
                    size={224}
                    title={`${PAYMENT_SOURCE_LABELS[step.invoice.source]} төлбөрийн QR код`}
                  />
                )}
              </div>
              <p className="text-3xl font-bold text-primary">{formatMNT(step.invoice.amount)}</p>
              <p className="text-xs text-muted-foreground">Захиалгын дугаар: {step.invoice.orderNo}</p>
              <StudentSummary student={step.student} />
            </div>
            <BankAppList apps={step.invoice.bankApps ?? []} open={appsOpen} onToggle={() => setAppsOpen((value) => !value)} />
            {step.invoice.demo && (
              <p className="rounded-lg bg-secondary px-3 py-2 text-xs leading-relaxed text-secondary-foreground">
                Туршилтын горим: {PAYMENT_SOURCE_LABELS[step.invoice.source]} нэвтрэх мэдээлэл тохируулаагүй тул төлбөр 5 секундийн дараа автоматаар баталгаажна.
              </p>
            )}
            <div aria-live="polite" className="min-h-5 text-sm">
              {notice && <p className="text-muted-foreground">{notice}</p>}
              {error && (
                <p role="alert" className="text-destructive">
                  {error}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={() => checkPayment()} disabled={busy} className="h-12 text-base">
                {busy ? (
                  <Loader2 aria-hidden="true" className="animate-spin" />
                ) : (
                  <RefreshCw aria-hidden="true" />
                )}
                Төлбөр шалгах
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setStep({ kind: 'review' })
                  setNotice(null)
                  setError(null)
                }}
                disabled={busy}
                className="h-10"
              >
                Буцах
              </Button>
            </div>
          </>
        )}

        {step.kind === 'paid' && (
          <>
            <div className="flex flex-col items-center gap-3 pt-4 text-center">
              <CheckCircle2 aria-hidden="true" className="size-16 text-success" />
              <DialogHeader className="items-center">
                <DialogTitle className="text-xl">Төлбөр амжилттай</DialogTitle>
                <DialogDescription>Төлбөр баталгаажлаа. Барааг эцэг эхэд гардуулна уу.</DialogDescription>
              </DialogHeader>
              <p className="text-3xl font-bold text-success">{formatMNT(step.paidAmount)}</p>
              <p className="text-xs text-muted-foreground">Захиалгын дугаар: {step.invoice.orderNo}</p>
              <StudentSummary student={step.student} />
            </div>
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border text-sm">
              {step.lines.map((line) => (
                <li key={line.key} className="flex justify-between gap-3 p-3">
                  <span>
                    {line.product.name}
                    {line.size ? ` (${line.size})` : ''}
                  </span>
                  <span className="shrink-0 text-muted-foreground">× {line.qty}</span>
                </li>
              ))}
            </ul>
            <Button onClick={() => handleOpenChange(false)} className="h-12 text-base">
              Шинэ борлуулалт эхлүүлэх
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
