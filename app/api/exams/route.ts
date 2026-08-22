import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { UserModel, RoomModel, ExamModel } from '@/lib/models'
import type { Exam } from '@/lib/exam-types'

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    await connectDB()
    const user = await UserModel.findOne({ id: userId }).lean()
    if (!user || ((user as Record<string, unknown>).role !== 'admin' && (user as Record<string, unknown>).role !== 'owner')) {
      return NextResponse.json({ error: 'Only admins or owners can create exams.' }, { status: 403 })
    }

    const body = await request.json().catch(() => null) as Exam | null
    if (!body?.title?.trim()) {
      return NextResponse.json({ error: 'Exam title is required.' }, { status: 400 })
    }
    if (!body.roomIds?.length) {
      return NextResponse.json({ error: 'Select at least one room.' }, { status: 400 })
    }
    if (body.duration < 1) {
      return NextResponse.json({ error: 'Duration must be at least 1 minute.' }, { status: 400 })
    }

    // Verify rooms exist
    const isOwner = (user as Record<string, unknown>).role === 'owner'
    const roomQuery = isOwner
      ? { id: { $in: body.roomIds } }
      : { id: { $in: body.roomIds }, $or: [{ adminId: userId }, { instituteId: (user as Record<string, unknown>).instituteId as string }] }

    const validRoomsCount = await RoomModel.countDocuments(roomQuery)
    if (validRoomsCount !== body.roomIds.length) {
      return NextResponse.json({ error: 'Invalid room selection.' }, { status: 403 })
    }

    const instituteId = isOwner
      ? (body.instituteId || undefined)
      : ((user as Record<string, unknown>).instituteId as string || undefined)

    const examToCreate = { ...body, instituteId }

    await ExamModel.create(examToCreate)
    return NextResponse.json({ exam: examToCreate }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/exams]', err)
    return NextResponse.json({ error: 'Failed to create exam.' }, { status: 500 })
  }
}
