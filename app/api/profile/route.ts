import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSessionUserId } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { UserModel } from '@/lib/models'

/**
 * PATCH /api/profile — Authenticated user updates their own profile (name, password).
 * Admins/students can edit name and password. Email is NOT editable through this endpoint.
 */
export async function PATCH(request: Request) {
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    await connectDB()

    const user = await UserModel.findOne({ id: userId }).lean()
    if (!user) return NextResponse.json({ error: 'Account not found.' }, { status: 404 })

    const body = await request.json().catch(() => null) as {
      name?: unknown
      currentPassword?: unknown
      newPassword?: unknown
    } | null

    const name = body?.name !== undefined ? String(body.name).trim() : undefined
    const currentPassword = body?.currentPassword ? String(body.currentPassword) : undefined
    const newPassword = body?.newPassword ? String(body.newPassword) : undefined

    const updates: Record<string, unknown> = {}

    // Update name
    if (name !== undefined) {
      if (!name) return NextResponse.json({ error: 'Name cannot be empty.' }, { status: 400 })
      if (name.length > 120) return NextResponse.json({ error: 'Name is too long.' }, { status: 400 })
      updates.name = name
    }

    // Update password (requires current password verification)
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Current password is required to set a new password.' },
          { status: 400 },
        )
      }
      if (newPassword.length < 4) {
        return NextResponse.json(
          { error: 'New password must be at least 4 characters.' },
          { status: 400 },
        )
      }

      const isCurrentValid = await bcrypt.compare(
        currentPassword,
        user.passwordHash as string,
      )
      if (!isCurrentValid) {
        return NextResponse.json(
          { error: 'Current password is incorrect.' },
          { status: 400 },
        )
      }

      updates.passwordHash = await bcrypt.hash(newPassword, 10)
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
    }

    await UserModel.updateOne({ id: userId }, { $set: updates })

    // Return the updated user data (without password hash)
    const updated = await UserModel.findOne({ id: userId }).lean()
    return NextResponse.json({
      user: {
        id: updated!.id,
        name: updated!.name,
        email: updated!.email,
        role: updated!.role,
      },
      message: 'Profile updated successfully.',
    })
  } catch (err) {
    console.error('[PATCH /api/profile]', err)
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 })
  }
}
