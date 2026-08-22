import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongodb'
import { OtpModel, UserModel } from '@/lib/models'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as {
      email?: unknown
      otp?: unknown
      newPassword?: unknown
    } | null

    const email = String(body?.email ?? '').trim().toLowerCase()
    const otp = String(body?.otp ?? '').trim()
    const newPassword = String(body?.newPassword ?? '')

    if (!email || !otp || !newPassword) {
      return NextResponse.json(
        { error: 'Email, OTP, and new password are required.' },
        { status: 400 },
      )
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        { error: 'Password must be at least 4 characters.' },
        { status: 400 },
      )
    }

    await connectDB()

    // Find the verified OTP (or re-verify if the user supplies the OTP again)
    const otpDoc = await OtpModel.findOne({
      email,
      purpose: 'password-reset',
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 }).lean()

    if (!otpDoc) {
      return NextResponse.json(
        { error: 'No valid reset session found. Please request a new code.' },
        { status: 400 },
      )
    }

    // Verify OTP again for security
    const isValid = await bcrypt.compare(otp, otpDoc.codeHash as string)
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid code. Please try the reset process again.' },
        { status: 400 },
      )
    }

    // Update the user's password
    const passwordHash = await bcrypt.hash(newPassword, 10)
    const result = await UserModel.updateOne(
      { id: otpDoc.userId },
      { $set: { passwordHash } },
    )

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { error: 'Account not found. Please contact support.' },
        { status: 404 },
      )
    }

    // Delete ALL OTPs for this email (cleanup)
    await OtpModel.deleteMany({ email })

    return NextResponse.json({
      message: 'Password has been reset successfully. You can now sign in with your new password.',
    })
  } catch (err) {
    console.error('[POST /api/auth/reset-password]', err)
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 })
  }
}
