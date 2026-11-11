import { SignJWT, jwtVerify } from 'jose'

// Shared by proxy.ts and server code, so it must not import 'server-only' or the database.

export const ACCESS_COOKIE = 'pos_admin_at'
export const REFRESH_COOKIE = 'pos_admin_rt'
export const COOKIE_PATH = '/admin'

export type TokenPayload = { sub: string; ver: number }
type TokenKind = 'access' | 'refresh'

const config = {
  access: { secret: () => process.env.JWT_ACCESS_SECRET, expiry: () => process.env.ACCESS_TOKEN_EXPIRY || '15m' },
  refresh: { secret: () => process.env.JWT_REFRESH_SECRET, expiry: () => process.env.REFRESH_TOKEN_EXPIRY || '7d' },
}

function key(kind: TokenKind) {
  const secret = config[kind].secret()
  if (!secret) throw new Error(`JWT_${kind.toUpperCase()}_SECRET is not set`)
  return new TextEncoder().encode(secret)
}

const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 }

/** Converts an expiry such as "7d", "12h" or "900" (seconds) to seconds. */
export function expirySeconds(kind: TokenKind) {
  const match = /^(\d+)\s*([smhdw]?)$/i.exec(config[kind].expiry().trim())
  if (!match) return kind === 'access' ? 900 : 7 * 86400
  return Number(match[1]) * UNIT_SECONDS[(match[2] || 's').toLowerCase()]
}

export function signToken(kind: TokenKind, payload: TokenPayload) {
  return new SignJWT({ ver: payload.ver, typ: kind })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${expirySeconds(kind)}s`)
    .sign(key(kind))
}

export async function verifyToken(kind: TokenKind, token: string | undefined): Promise<TokenPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, key(kind), { algorithms: ['HS256'] })
    if (payload.typ !== kind || typeof payload.sub !== 'string' || typeof payload.ver !== 'number') return null
    return { sub: payload.sub, ver: payload.ver }
  } catch {
    return null
  }
}

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: COOKIE_PATH,
    maxAge,
  }
}
