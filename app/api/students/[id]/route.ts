import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSessionUserId } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { UserModel, RoomModel, AttemptModel } from '@/lib/models'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const creatorId = await getSessionUserId()
    if (!creatorId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const { id } = await params
    await connectDB()

    const creator = await UserModel.findOne({ id: creatorId }).lean()
    if (!creator || (creator.role !== 'admin' && creator.role !== 'owner')) {
      return NextResponse.json({ error: 'Only admins or owners can edit accounts.' }, { status: 403 })
    }

    const targetUser = await UserModel.findOne({ id })
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    }

    // Enforce institute isolation
    if (creator.role === 'admin' && targetUser.instituteId !== creator.instituteId) {
      return NextResponse.json({ error: 'Unauthorized to edit users outside your institute.' }, { status: 403 })
    }

    const body = await request.json().catch(() => null) as {
      name?: unknown
      email?: unknown
      password?: unknown
    } | null

    const name = String(body?.name ?? '').trim()
    const email = String(body?.email ?? '').trim().toLowerCase()
    const password = body?.password ? String(body.password) : undefined

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 })
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })
    }

    if (email !== targetUser.email) {
      const existing = await UserModel.findOne({ email, id: { $ne: id } })
      if (existing) {
        return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 })
      }
    }

    const update: Record<string, unknown> = { name, email }
    if (password) {
      if (password.length < 4) {
        return NextResponse.json({ error: 'Password must be at least 4 characters.' }, { status: 400 })
      }
      update.passwordHash = await bcrypt.hash(password, 10)
    }

    await UserModel.updateOne({ id }, { $set: update })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/students/[id]]', err)
    return NextResponse.json({ error: 'Failed to update account.' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const creatorId = await getSessionUserId()
    if (!creatorId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const { id } = await params
    await connectDB()

    const creator = await UserModel.findOne({ id: creatorId }).lean()
    if (!creator || (creator.role !== 'admin' && creator.role !== 'owner')) {
      return NextResponse.json({ error: 'Only admins or owners can delete accounts.' }, { status: 403 })
    }

    const targetUser = await UserModel.findOne({ id }).lean()
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    }

    // Enforce institute isolation
    if (creator.role === 'admin' && targetUser.instituteId !== creator.instituteId) {
      return NextResponse.json({ error: 'Unauthorized to delete users outside your institute.' }, { status: 403 })
    }

    await Promise.all([
      UserModel.deleteOne({ id }),
      RoomModel.updateMany({ memberIds: id }, { $pull: { memberIds: id } }),
      AttemptModel.deleteMany({ userId: id }),
    ])

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/students/[id]]', err)
    return NextResponse.json({ error: 'Failed to delete account.' }, { status: 500 })
  }
}
