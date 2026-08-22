import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongodb'
import { UserModel, OtpModel } from '@/lib/models'
import { sendMail } from '@/lib/mailer'
import { passwordResetOtpEmail } from '@/lib/email-templates'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { email?: unknown } | null
    const email = String(body?.email ?? '').trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }

    await connectDB()

    // Always return success to prevent email enumeration attacks
    const successResponse = NextResponse.json({
      message: 'If an account with that email exists, a verification code has been sent.',
    })

    const dbUser = await UserModel.findOne({ email }).lean()
    if (!dbUser) return successResponse

    // Delete any existing OTPs for this user
    await OtpModel.deleteMany({ email })

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000))
    const codeHash = await bcrypt.hash(otp, 10)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    await OtpModel.create({
      id: crypto.randomUUID(),
      userId: dbUser.id as string,
      email,
      codeHash,
      purpose: 'password-reset',
      expiresAt,
    })

    // Find institute name for email branding
    let instituteName: string | undefined
    if ((dbUser as any).instituteId) {
      const { InstituteModel } = await import('@/lib/models')
      const institute = await InstituteModel.findOne({ id: (dbUser as any).instituteId }).lean()
      if (institute) instituteName = (institute as any).name
    }

    // Send OTP email (fire-and-forget — don't block response on email delivery)
    sendMail({
      to: email,
      subject: `Password Reset Verification Code - ${instituteName || 'Mock Test Platform'}`,
      html: passwordResetOtpEmail({
        userName: dbUser.name as string,
        otp,
        expiryMinutes: 10,
        instituteName,
      }),
    })

    return successResponse
  } catch (err) {
    console.error('[POST /api/auth/forgot-password]', err)
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 })
  }
}
