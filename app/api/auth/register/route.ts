import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongodb'
import { UserModel, InstituteModel } from '@/lib/models'
import { buildSetCookieHeader } from '@/lib/auth'
import { seedIfEmpty } from '@/lib/seed'
import type { User, Institute } from '@/lib/exam-types'

const SALT_ROUNDS = 10

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as {
      name?: unknown
      email?: unknown
      password?: unknown
      instituteName?: unknown
      instituteDescription?: unknown
      role?: unknown
    } | null

    const name = String(body?.name ?? '').trim()
    const email = String(body?.email ?? '').trim().toLowerCase()
    const password = String(body?.password ?? '')
    const instituteName = String(body?.instituteName ?? '').trim()
    const instituteDescription = String(body?.instituteDescription ?? '').trim()
    const requestedRole = String(body?.role ?? '').trim().toLowerCase()

    // ── STRICT CONSTRAINT: Owner role registration is strictly forbidden ─────
    if (requestedRole === 'owner') {
      return NextResponse.json(
        { error: 'Registration as Owner is strictly prohibited.' },
        { status: 400 },
      )
    }

    if (!name || !email || !password || !instituteName) {
      return NextResponse.json(
        { error: 'Full name, email, password, and Institute Name are required.' },
        { status: 400 },
      )
    }
    if (name.length > 120) {
      return NextResponse.json({ error: 'Name is too long (max 120 characters).' }, { status: 400 })
    }
    if (instituteName.length > 120) {
      return NextResponse.json({ error: 'Institute name is too long (max 120 characters).' }, { status: 400 })
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

    const userId = crypto.randomUUID()
    const instId = crypto.randomUUID()
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

    // Create Institute in 'pending' status
    const createdInstitute = await InstituteModel.create({
      id: instId,
      name: instituteName,
      description: instituteDescription || undefined,
      status: 'pending',
    })

    // Create User with role 'admin'
    await UserModel.create({
      id: userId,
      name,
      email,
      passwordHash,
      role: 'admin',
      roomIds: [],
      instituteId: instId,
      status: 'active',
    })

    // ─── Fire-and-forget: Notify Owner via email ──────────────────────
    try {
      const ownerUser = await UserModel.findOne({ role: 'owner' }).lean()
      const ownerEmail = (ownerUser as any)?.email || process.env.OWNER_EMAIL
      if (ownerEmail) {
        const { sendMail } = await import('@/lib/mailer')
        const { newInstitutePendingNoticeEmail } = await import('@/lib/email-templates')
        sendMail({
          to: ownerEmail,
          subject: `New Institute Registration Request: ${instituteName}`,
          html: newInstitutePendingNoticeEmail({
            ownerName: (ownerUser as any)?.name || 'Platform Owner',
            adminName: name,
            adminEmail: email,
            instituteName,
            description: instituteDescription,
          }),
        })
      }
    } catch (e) {
      console.warn('[POST /api/auth/register] Owner notification email failed to dispatch:', e)
    }
    // ─────────────────────────────────────────────────────────────────

    const user: User = {
      id: userId,
      name,
      email,
      password: '',
      role: 'admin',
      roomIds: [],
      instituteId: instId,
      status: 'active',
    }

    const institute: Institute = {
      id: instId,
      name: instituteName,
      description: instituteDescription || undefined,
      status: 'pending',
    }

    const res = NextResponse.json({ user, institute }, { status: 201 })
    res.headers.set('Set-Cookie', buildSetCookieHeader(userId))
    return res
  } catch (err) {
    console.error('[POST /api/auth/register]', err)
    if (err instanceof Error && err.message.includes('MONGODB_URI')) {
      return NextResponse.json({ error: 'Database not configured. Add MONGODB_URI to .env' }, { status: 503 })
    }
    const message = err instanceof Error && err.message ? err.message : 'Registration failed. Please try again.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
