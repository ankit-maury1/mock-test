import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongodb'
import { OtpModel } from '@/lib/models'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as {
      email?: unknown
      otp?: unknown
    } | null

    const email = String(body?.email ?? '').trim().toLowerCase()
    const otp = String(body?.otp ?? '').trim()

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and OTP are required.' }, { status: 400 })
    }

    await connectDB()

    // Find the latest unexpired OTP for this email
    const otpDoc = await OtpModel.findOne({
      email,
      purpose: 'password-reset',
      verified: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 }).lean()

    if (!otpDoc) {
      return NextResponse.json(
        { error: 'Invalid or expired code. Please request a new one.' },
        { status: 400 },
      )
    }

    const isValid = await bcrypt.compare(otp, otpDoc.codeHash as string)
    if (!isValid) {
      return NextResponse.json(
        { error: 'Incorrect code. Please check and try again.' },
        { status: 400 },
      )
    }

    // Mark as verified (but don't delete yet — the reset-password step will delete it)
    await OtpModel.updateOne({ id: otpDoc.id }, { $set: { verified: true } })

    return NextResponse.json({
      message: 'Code verified successfully.',
      verified: true,
    })
  } catch (err) {
    console.error('[POST /api/auth/verify-otp]', err)
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 })
  }
}
