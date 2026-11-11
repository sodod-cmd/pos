'use server'

import { revalidatePath } from 'next/cache'
import { readField, type AdminFormState } from '@/lib/admin-form'
import { requireAdmin } from '@/lib/auth/session'
import { applyStockChanges, type StockChange, type StockMode } from '@/lib/inventory'

const MODES: StockMode[] = ['restock', 'writeoff', 'count']
const MAX_STOCK = 99_999

/** The stock sheet on /admin/inventory: many sizes of many products in one submit. */
export async function saveStockSheet(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin()
  const mode = readField(formData, 'mode', 10) as StockMode
  const note = readField(formData, 'note', 200)
  if (!MODES.includes(mode)) return { status: 'error', message: 'Үйлдэл сонгоно уу.', attempt: Date.now() }

  let raw: unknown
  try {
    raw = JSON.parse(readField(formData, 'changes', 200_000) || '[]')
  } catch {
    raw = null
  }
  if (!Array.isArray(raw)) return { status: 'error', message: 'Өгөгдөл буруу байна. Хуудсаа дахин ачаална уу.', attempt: Date.now() }

  const changes: StockChange[] = []
  for (const item of raw as Partial<StockChange>[]) {
    if (typeof item?.productId !== 'string' || typeof item.size !== 'string') continue
    const qty = Number(item.qty)
    if (!Number.isInteger(qty) || qty < 0 || qty > MAX_STOCK) {
      return { status: 'invalid', message: 'Тоо ширхэгийг 0-ээс их бүхэл тоогоор оруулна уу.', attempt: Date.now(), values: { note } }
    }
    changes.push({ productId: item.productId, size: item.size, qty })
  }
  if (changes.length === 0) return { status: 'invalid', message: 'Өөрчлөх тоо оруулаагүй байна.', attempt: Date.now(), values: { note } }

  const results = await applyStockChanges(mode, changes.slice(0, 1000), { note, actor: { id: admin.id, name: admin.name } })
  const ok = results.filter((r) => r.ok)
  const failed = results.filter((r) => !r.ok)

  revalidatePath('/')
  revalidatePath('/admin', 'layout')

  const units = ok.reduce((sum, r) => sum + (r.ok ? Math.abs(r.delta) : 0), 0)
  const summary =
    ok.length === 0
      ? 'Үлдэгдэл өөрчлөгдсөнгүй.'
      : mode === 'count'
        ? `${ok.length} хэмжээний үлдэгдлийг тооллогоор зассан.`
        : `${ok.length} хэмжээнд нийт ${units} ширхэг ${mode === 'restock' ? 'орлого авлаа' : 'хорогдуулав'}.`
  const problems = failed.map((r) => `${r.productName}${r.size ? ` (${r.size})` : ''}: ${r.ok ? '' : r.reason}`)
  return {
    status: failed.length && !ok.length ? 'error' : 'success',
    message: problems.length ? `${summary} Амжилтгүй: ${problems.join('; ')}` : summary,
    attempt: Date.now(),
  }
}
