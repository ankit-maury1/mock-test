import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongodb'
import { UserModel } from '@/lib/models'
import { buildSetCookieHeader } from '@/lib/auth'
import { seedIfEmpty } from '@/lib/seed'
import type { User } from '@/lib/exam-types'

const SALT_ROUNDS = 10

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as {
      name?: unknown
      email?: unknown
      password?: unknown
    } | null

    const name = String(body?.name ?? '').trim()
    const email = String(body?.email ?? '').trim().toLowerCase()
    const password = String(body?.password ?? '')

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Full name, email, and password are required.' },
        { status: 400 },
      )
    }
    if (name.length > 120) {
      return NextResponse.json({ error: 'Name is too long (max 120 characters).' }, { status: 400 })
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters.' },
        { status: 400 },
      )
    }

    await connectDB()
    await seedIfEmpty()

    const existing = await UserModel.findOne({ email })
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 },
      )
    }

    const id = crypto.randomUUID()
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

    await UserModel.create({ id, name, email, passwordHash, role: 'student', roomIds: [] })

    const user: User = { id, name, email, password: '', role: 'student', roomIds: [] }
    const res = NextResponse.json({ user }, { status: 201 })
    res.headers.set('Set-Cookie', buildSetCookieHeader(id))
    return res
  } catch (err) {
    console.error('[POST /api/auth/register]', err)
    if (err instanceof Error && err.message.includes('MONGODB_URI')) {
      return NextResponse.json({ error: 'Database not configured. Add MONGODB_URI to .env' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 })
  }
}
