import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSessionUserId } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { UserModel } from '@/lib/models'
import type { User } from '@/lib/exam-types'

export async function POST(request: Request) {
  try {
    const creatorId = await getSessionUserId()
    if (!creatorId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    await connectDB()
    const creator = await UserModel.findOne({ id: creatorId }).lean()
    if (!creator || (creator.role !== 'admin' && creator.role !== 'owner')) {
      return NextResponse.json({ error: 'Only admins or owners can create accounts.' }, { status: 403 })
    }

    const body = await request.json().catch(() => null) as {
      name?: unknown
      email?: unknown
      password?: unknown
      role?: unknown
      instituteId?: unknown
    } | null

    const name = String(body?.name ?? '').trim()
    const email = String(body?.email ?? '').trim().toLowerCase()
    const password = String(body?.password ?? '')
    let role = String(body?.role ?? 'student').trim().toLowerCase()
    let instituteId = String(body?.instituteId ?? '').trim()

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required.' }, { status: 400 })
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })
    }
    if (password.length < 4) {
      return NextResponse.json({ error: 'Password must be at least 4 characters.' }, { status: 400 })
    }
    if (role !== 'admin' && role !== 'student') {
      return NextResponse.json({ error: 'Role must be admin or student.' }, { status: 400 })
    }

    // Role and Institute mapping logic
    if (creator.role === 'admin') {
      // Admins can only create users in their own institute
      instituteId = creator.instituteId || ''
    } else if (creator.role === 'owner') {
      // Owners must supply an instituteId
      if (!instituteId) {
        return NextResponse.json({ error: 'Institute selection is required.' }, { status: 400 })
      }
    }

    const existing = await UserModel.findOne({ email })
    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 })
    }

    const id = crypto.randomUUID()
    const passwordHash = await bcrypt.hash(password, 10)
    await UserModel.create({ id, name, email, passwordHash, role, roomIds: [], instituteId })

    // ─── Send welcome email ─────────────────────────────────────────────
    // Fire-and-forget — don't block the API response on email delivery
    let instituteName = ''
    if (instituteId) {
      const { InstituteModel } = await import('@/lib/models')
      const institute = await InstituteModel.findOne({ id: instituteId }).lean()
      if (institute) instituteName = (institute as any).name || ''
    }

    if (instituteName) {
      const { sendMail } = await import('@/lib/mailer')
      if (role === 'admin') {
        const { welcomeAdminEmail } = await import('@/lib/email-templates')
        sendMail({
          to: email,
          subject: `Administrator Access Credentials - ${instituteName}`,
          html: welcomeAdminEmail({
            instituteName,
            adminName: name,
            email,
            password,
          }),
        })
      } else {
        const { welcomeStudentEmail } = await import('@/lib/email-templates')
        sendMail({
          to: email,
          subject: `Account Access Credentials - ${instituteName}`,
          html: welcomeStudentEmail({
            instituteName,
            studentName: name,
            email,
            password,
          }),
        })
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    const user: User = { id, name, email, password: '', role: role as any, roomIds: [], instituteId }
    return NextResponse.json({ user }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/students]', err)
    return NextResponse.json({ error: 'Failed to create account.' }, { status: 500 })
  }
}
