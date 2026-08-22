import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { UserModel, RoomModel } from '@/lib/models'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const adminId = await getSessionUserId()
    if (!adminId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const { id: roomId } = await params
    const body = await request.json().catch(() => null) as {
      studentId?: unknown
      joined?: unknown
    } | null

    const studentId = String(body?.studentId ?? '').trim()
    const joined = Boolean(body?.joined)

    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required.' }, { status: 400 })
    }

    await connectDB()

    const user = await UserModel.findOne({ id: adminId }).lean()
    if (!user || ((user as Record<string, unknown>).role !== 'admin' && (user as Record<string, unknown>).role !== 'owner')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
    }

    // Verify room access
    const isOwner = (user as Record<string, unknown>).role === 'owner'
    const room = await RoomModel.findOne(
      isOwner
        ? { id: roomId }
        : { id: roomId, $or: [{ adminId }, { instituteId: (user as Record<string, unknown>).instituteId }] },
    ).lean()
    if (!room) return NextResponse.json({ error: 'Room not found.' }, { status: 404 })

    // Verify target is a student
    const student = await UserModel.findOne({ id: studentId, role: 'student' }).lean()
    if (!student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 })

    if (joined) {
      await Promise.all([
        RoomModel.updateOne({ id: roomId }, { $addToSet: { memberIds: studentId } }),
        UserModel.updateOne({ id: studentId }, { $addToSet: { roomIds: roomId } }),
      ])
    } else {
      await Promise.all([
        RoomModel.updateOne({ id: roomId }, { $pull: { memberIds: studentId } }),
        UserModel.updateOne({ id: studentId }, { $pull: { roomIds: roomId } }),
      ])
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/rooms/[id]/members]', err)
    return NextResponse.json({ error: 'Failed to update room membership.' }, { status: 500 })
  }
}
