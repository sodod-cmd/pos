'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { readField } from '@/lib/admin-form'
import { requireAdmin } from '@/lib/auth/session'
import { cancelOrder, getOrderById, refundOrder, syncPayment } from '@/lib/orders'

function revalidateOrders(id: string) {
  revalidatePath('/')
  revalidatePath('/admin', 'layout')
  revalidatePath(`/admin/orders/${id}`)
}

/** Asks the payment provider again (Bonum: re-reads the webhook result), e.g. when the cashier closed the dialog before the payment came through. */
export async function recheckPayment(id: string) {
  await requireAdmin()
  const order = await getOrderById(id)
  if (!order) redirect('/admin/orders')
  let flash = 'unpaid'
  try {
    const result = await syncPayment(order)
    flash = result.paid ? 'paid' : 'unpaid'
  } catch (error) {
    console.error('[admin-orders] Payment check failed', error)
    flash = 'check-failed'
  }
  revalidateOrders(id)
  redirect(`/admin/orders/${id}?flash=${flash}`)
}

export async function cancelOrderAction(id: string) {
  const admin = await requireAdmin()
  const ok = await cancelOrder(id, { id: admin.id, name: admin.name })
  revalidateOrders(id)
  redirect(`/admin/orders/${id}?flash=${ok ? 'cancelled' : 'not-pending'}`)
}

export async function refundOrderAction(id: string, formData: FormData) {
  const admin = await requireAdmin()
  const note = readField(formData, 'note', 300)
  const ok = await refundOrder(id, { id: admin.id, name: admin.name }, note)
  revalidateOrders(id)
  redirect(`/admin/orders/${id}?flash=${ok ? 'refunded' : 'not-paid'}`)
}
