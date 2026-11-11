'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyCredentials } from '@/lib/admin-users'
import { EMAIL_RE, readField, type AdminFormState } from '@/lib/admin-form'
import { clearFailures, lockedFor, recordFailure } from '@/lib/auth/rate-limit'
import { createSession, deleteSession } from '@/lib/auth/session'

/** Only same-site admin paths, so ?next= cannot send people elsewhere. */
function safeNext(value: string) {
  return /^\/admin(\/[\w\-/?=&%.]*)?$/.test(value) && !value.startsWith('/admin/login') ? value : '/admin'
}

export async function login(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const email = readField(formData, 'email', 200).toLowerCase()
  const password = typeof formData.get('password') === 'string' ? (formData.get('password') as string).slice(0, 200) : ''
  const values = { email }

  const errors: Record<string, string> = {}
  if (!email) errors.email = 'Имэйл хаягаа оруулна уу.'
  else if (!EMAIL_RE.test(email)) errors.email = 'Имэйл хаяг буруу форматтай байна.'
  if (!password) errors.password = 'Нууц үгээ оруулна уу.'
  if (Object.keys(errors).length) return { status: 'invalid', errors, values }

  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  const key = `${ip}:${email}`
  const wait = lockedFor(key)
  if (wait) {
    return {
      status: 'error',
      message: `Олон удаа буруу оролдлоо. ${Math.ceil(wait / 60000)} минутын дараа дахин оролдоно уу.`,
      values,
    }
  }

  let admin
  try {
    admin = await verifyCredentials(email, password)
  } catch (error) {
    console.error('[auth] Login failed', error)
    return { status: 'error', message: 'Сервертэй холбогдож чадсангүй. Түр хүлээгээд дахин оролдоно уу.', values }
  }
  if (!admin) {
    recordFailure(key)
    return { status: 'error', message: 'Имэйл эсвэл нууц үг буруу байна.', values }
  }

  clearFailures(key)
  await createSession(admin)
  redirect(safeNext(readField(formData, 'next', 300)))
}

export async function logout() {
  await deleteSession()
  redirect('/admin/login')
}
