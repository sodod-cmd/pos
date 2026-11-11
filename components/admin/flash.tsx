'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type FlashMessage = { tone: 'success' | 'warning'; text: string }

/** Shows a one-off message passed in ?flash= and drops the parameter so a reload does not repeat it. */
export function Flash({ message: initial }: { message?: FlashMessage }) {
  const router = useRouter()
  // Kept in state so the message survives the re-render without ?flash=.
  const [message, setMessage] = useState(initial)

  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('flash')) return
    url.searchParams.delete('flash')
    router.replace(url.pathname + url.search, { scroll: false })
  }, [router])

  if (!message) return null
  const Icon = message.tone === 'success' ? CheckCircle2 : AlertTriangle
  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium',
        message.tone === 'success' ? 'border-success/25 bg-success/10 text-success' : 'border-warning/50 bg-warning/15 text-warning-foreground',
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      <p className="flex-1">{message.text}</p>
      <button type="button" onClick={() => setMessage(undefined)} className="rounded-md p-1 opacity-70 hover:opacity-100">
        <X className="size-4" aria-hidden="true" />
        <span className="sr-only">Хаах</span>
      </button>
    </div>
  )
}
