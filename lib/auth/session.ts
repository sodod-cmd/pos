import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAdminById, type Admin } from '@/lib/admin-users'
import {
  ACCESS_COOKIE,
  COOKIE_PATH,
  REFRESH_COOKIE,
  cookieOptions,
  expirySeconds,
  signToken,
  verifyToken,
} from '@/lib/auth/tokens'

export async function createSession(admin: Pick<Admin, 'id' | 'tokenVersion'>) {
  const payload = { sub: admin.id, ver: admin.tokenVersion }
  const [access, refresh] = await Promise.all([signToken('access', payload), signToken('refresh', payload)])
  const store = await cookies()
  store.set(ACCESS_COOKIE, access, cookieOptions(expirySeconds('access')))
  store.set(REFRESH_COOKIE, refresh, cookieOptions(expirySeconds('refresh')))
}

export async function deleteSession() {
  const store = await cookies()
  store.delete({ name: ACCESS_COOKIE, path: COOKIE_PATH })
  store.delete({ name: REFRESH_COOKIE, path: COOKIE_PATH })
}

/**
 * The signed-in admin, or null. The token alone is not trusted: the account must
 * still exist and its tokenVersion must match, so deleting an admin or changing
 * their password ends their sessions.
 */
export const getCurrentAdmin = cache(async (): Promise<Admin | null> => {
  const payload = await verifyToken('access', (await cookies()).get(ACCESS_COOKIE)?.value)
  if (!payload) return null
  const admin = await getAdminById(payload.sub)
  if (!admin || admin.tokenVersion !== payload.ver) return null
  return admin
})

export async function requireAdmin() {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/admin/login')
  return admin
}
