import { NextResponse } from 'next/server'
import { buildSetCookieHeader } from '@/lib/auth'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.headers.set('Set-Cookie', buildSetCookieHeader(null))
  return res
}
