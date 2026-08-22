import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { UserModel, RoomModel } from '@/lib/models'

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    await connectDB()
    const user = await UserModel.findOne({ id: userId }).lean()
    if (!user || ((user as Record<string, unknown>).role !== 'admin' && (user as Record<string, unknown>).role !== 'owner')) {
      return NextResponse.json({ error: 'Only admins or owners can create rooms.' }, { status: 403 })
    }

    const body = await request.json().catch(() => null) as { name?: unknown; subject?: unknown; instituteId?: unknown } | null
    const name = String(body?.name ?? '').trim()
    const subject = String(body?.subject ?? '').trim()
    let instituteId = String(body?.instituteId ?? '').trim()

    if (!name) return NextResponse.json({ error: 'Room name is required.' }, { status: 400 })
    if (!subject) return NextResponse.json({ error: 'Subject is required.' }, { status: 400 })
    if (name.length > 120) return NextResponse.json({ error: 'Room name too long.' }, { status: 400 })

    const id = crypto.randomUUID()
    const code = Math.random().toString(36).slice(2, 8).toUpperCase()

    if ((user as Record<string, unknown>).role === 'admin') {
      instituteId = (user as Record<string, unknown>).instituteId as string || ''
    }

    const room = { id, name, subject, code, adminId: userId, memberIds: [] as string[], instituteId: instituteId || undefined }

    await Promise.all([
      RoomModel.create(room),
      UserModel.updateOne({ id: userId }, { $addToSet: { roomIds: id } }),
    ])

    return NextResponse.json({ room }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/rooms]', err)
    return NextResponse.json({ error: 'Failed to create room.' }, { status: 500 })
  }
}
