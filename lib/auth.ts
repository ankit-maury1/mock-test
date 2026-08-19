import { createHmac } from 'crypto'
import { cookies } from 'next/headers'
import { serverEnv } from './env'

const COOKIE_NAME = 'axis_sid'
const MAX_AGE_SECS = 7 * 24 * 60 * 60 // 7 days

function hmac(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('hex')
}

/**
 * Creates a signed, tamper-evident session token.
 * Format: base64url(userId) + '.' + hmac_sha256(base64url(userId), AUTH_SECRET)
 */
export function makeSessionToken(userId: string): string {
  const payload = Buffer.from(userId).toString('base64url')
  const sig = hmac(payload, serverEnv.AUTH_SECRET)
  return `${payload}.${sig}`
}

/**
 * Verifies a session token and returns the userId, or null if tampered/invalid.
 */
export function verifySessionToken(token: string): string | null {
  try {
    const dot = token.lastIndexOf('.')
    if (dot < 1) return null
    const payload = token.slice(0, dot)
    const sig = token.slice(dot + 1)
    const expected = hmac(payload, serverEnv.AUTH_SECRET)
    // Constant-time comparison to prevent timing attacks
    if (sig.length !== expected.length) return null
    let diff = 0
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
    if (diff !== 0) return null
    return Buffer.from(payload, 'base64url').toString()
  } catch {
    return null
  }
}

/**
 * Reads the httpOnly session cookie and returns the authenticated userId, or null.
 */
export async function getSessionUserId(): Promise<string | null> {
  try {
    const jar = await cookies()
    const token = jar.get(COOKIE_NAME)?.value
    if (!token) return null
    return verifySessionToken(token)
  } catch {
    return null
  }
}

/**
 * Returns the Set-Cookie header string for setting or clearing the session.
 * @param userId  Pass userId to create a session; pass null to delete it.
 */
export function buildSetCookieHeader(userId: string | null): string {
  if (!userId) {
    return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  }
  const token = makeSessionToken(userId)
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECS}${secure}`
}
