'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  MIN_PASSWORD_LENGTH,
  countAdmins,
  createAdmin,
  deleteAdmin,
  emailTaken,
  getAdminById,
  updateAdmin,
} from '@/lib/admin-users'
import { EMAIL_RE, readField, type AdminFormState } from '@/lib/admin-form'
import { createSession, requireAdmin } from '@/lib/auth/session'

export async function saveAdmin(id: string | null, _prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const current = await requireAdmin()
  if (id && !(await getAdminById(id))) return { status: 'error', message: 'Админ олдсонгүй.' }

  const values = { name: readField(formData, 'name', 100), email: readField(formData, 'email', 200).toLowerCase() }
  const password = typeof formData.get('password') === 'string' ? (formData.get('password') as string) : ''
  const confirm = typeof formData.get('confirm') === 'string' ? (formData.get('confirm') as string) : ''

  const errors: Record<string, string> = {}
  if (values.name.length < 2) errors.name = 'Нэрээ оруулна уу.'
  if (!EMAIL_RE.test(values.email)) errors.email = 'Имэйл хаяг буруу форматтай байна.'
  else if (await emailTaken(values.email, id ?? undefined)) errors.email = 'Энэ имэйлээр бүртгэлтэй админ байна.'
  if (!id || password) {
    if (password.length < MIN_PASSWORD_LENGTH) errors.password = `Нууц үг дор хаяж ${MIN_PASSWORD_LENGTH} тэмдэгт байна.`
    else if (password.length > 128) errors.password = 'Нууц үг хэт урт байна.'
    else if (password !== confirm) errors.confirm = 'Нууц үг таарахгүй байна.'
  }
  if (Object.keys(errors).length) return { status: 'invalid', errors, values }

  let savedId = id
  try {
    if (id) {
      const updated = await updateAdmin(id, { ...values, password: password || undefined })
      // A password change ends every session of that admin; keep the person who made it signed in.
      if (updated && id === current.id && password) await createSession(updated)
    } else {
      savedId = await createAdmin({ ...values, password })
    }
  } catch (error) {
    console.error('[admin-users] Save failed', error)
    return { status: 'error', message: 'Хадгалах үед алдаа гарлаа. Дахин оролдоно уу.', values }
  }

  revalidatePath('/admin', 'layout')
  redirect(`/admin/users/${savedId}?flash=${id ? 'updated' : 'created'}`)
}

export async function removeAdmin(id: string) {
  const current = await requireAdmin()
  if (id === current.id) redirect(`/admin/users/${id}?flash=self`)
  if ((await countAdmins()) <= 1) redirect(`/admin/users/${id}?flash=last`)
  await deleteAdmin(id)
  revalidatePath('/admin', 'layout')
  redirect('/admin/users?flash=deleted')
}
