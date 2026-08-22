import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { UserModel, RoomModel, ExamModel } from '@/lib/models'

/** Verifies user has access to manage the room */
async function getAccessibleRoom(roomId: string, user: Record<string, unknown>) {
  if (user.role === 'owner') {
    return RoomModel.findOne({ id: roomId }).lean()
  }
  return RoomModel.findOne({ id: roomId, $or: [{ adminId: user.id }, { instituteId: user.instituteId }] }).lean()
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const { id } = await params
    await connectDB()

    const user = await UserModel.findOne({ id: userId, role: { $in: ['admin', 'owner'] } }).lean()
    if (!user) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

    const room = await getAccessibleRoom(id, user as Record<string, unknown>)
    if (!room) return NextResponse.json({ error: 'Room not found.' }, { status: 404 })

    const body = await request.json().catch(() => null) as { name?: unknown; subject?: unknown } | null
    const name = body?.name !== undefined ? String(body.name).trim() : undefined
    const subject = body?.subject !== undefined ? String(body.subject).trim() : undefined

    const updateFields: Record<string, string> = {}
    if (name) updateFields.name = name
    if (subject) updateFields.subject = subject

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided to update.' }, { status: 400 })
    }

    await RoomModel.updateOne({ id }, { $set: updateFields })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/rooms/[id]]', err)
    return NextResponse.json({ error: 'Failed to update room.' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const { id } = await params
    await connectDB()

    const user = await UserModel.findOne({ id: userId, role: { $in: ['admin', 'owner'] } }).lean()
    if (!user) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

    const room = await getAccessibleRoom(id, user as Record<string, unknown>)
    if (!room) return NextResponse.json({ error: 'Room not found.' }, { status: 404 })

    await Promise.all([
      RoomModel.deleteOne({ id }),
      UserModel.updateMany({ roomIds: id }, { $pull: { roomIds: id } }),
      ExamModel.updateMany({ roomIds: id }, { $pull: { roomIds: id } }),
    ])

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/rooms/[id]]', err)
    return NextResponse.json({ error: 'Failed to delete room.' }, { status: 500 })
  }
}
