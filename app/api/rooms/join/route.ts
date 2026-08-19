import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { UserModel, RoomModel } from '@/lib/models'

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const body = await request.json().catch(() => null) as { code?: unknown } | null
    const code = String(body?.code ?? '').trim().toUpperCase()
    if (!code) return NextResponse.json({ error: 'Room code is required.' }, { status: 400 })
    if (!/^[A-Z0-9]{4,10}$/.test(code)) {
      return NextResponse.json({ error: 'Invalid room code format.' }, { status: 400 })
    }

    await connectDB()

    const room = await RoomModel.findOne({ code }).lean()
    if (!room) return NextResponse.json({ error: 'No room matches that code.' }, { status: 404 })

    const roomDoc = room as Record<string, unknown>
    const roomId = roomDoc.id as string

    const user = await UserModel.findOne({ id: userId }).lean()
    if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 })

    if (roomDoc.instituteId !== (user as any).instituteId) {
      return NextResponse.json({ error: 'No room matches that code.' }, { status: 404 })
    }

    const userRoomIds = ((user as Record<string, unknown>)?.roomIds as string[]) ?? []
    if (userRoomIds.includes(roomId)) {
      return NextResponse.json({ error: 'You already joined this room.' }, { status: 409 })
    }

    await Promise.all([
      RoomModel.updateOne({ id: roomId }, { $addToSet: { memberIds: userId } }),
      UserModel.updateOne({ id: userId }, { $addToSet: { roomIds: roomId } }),
    ])

    return NextResponse.json({ roomId })
  } catch (err) {
    console.error('[POST /api/rooms/join]', err)
    return NextResponse.json({ error: 'Failed to join room.' }, { status: 500 })
  }
}
