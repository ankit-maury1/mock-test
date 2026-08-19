import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongodb'
import { UserModel } from '@/lib/models'
import { buildSetCookieHeader } from '@/lib/auth'
import { seedIfEmpty } from '@/lib/seed'
import type { User } from '@/lib/exam-types'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown } | null
    const email = String(body?.email ?? '').trim().toLowerCase()
    const password = String(body?.password ?? '')

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }

    await connectDB()
    await seedIfEmpty()

    const dbUser = await UserModel.findOne({ email }).lean()

    // Use a dummy compare when user not found to prevent timing-based user enumeration
    const dummyHash = '$2b$10$invalidhashtopreventtimingattacks0000000000000000000000'
    const passwordMatch = await bcrypt.compare(
      password,
      (dbUser?.passwordHash as string) ?? dummyHash,
    )

    if (!dbUser || !passwordMatch) {
      return NextResponse.json({ error: 'Email or password is incorrect.' }, { status: 401 })
    }

    const user: User = {
      id: dbUser.id as string,
      name: dbUser.name as string,
      email: dbUser.email as string,
      password: '',
      role: dbUser.role as 'admin' | 'student',
      roomIds: (dbUser.roomIds as string[]) ?? [],
    }

    const res = NextResponse.json({ user })
    res.headers.set('Set-Cookie', buildSetCookieHeader(user.id))
    return res
  } catch (err) {
    console.error('[POST /api/auth/login]', err)
    if (err instanceof Error && err.message.includes('MONGODB_URI')) {
      return NextResponse.json({ error: 'Database not configured. Add MONGODB_URI to .env' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 })
  }
}
