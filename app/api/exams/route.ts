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
    const admin = await UserModel.findOne({ id: userId }).lean()
    if (!admin || (admin as Record<string, unknown>).role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can create exams.' }, { status: 403 })
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

    // Verify admin owns all specified rooms
    const ownedCount = await RoomModel.countDocuments({
      id: { $in: body.roomIds },
      adminId: userId,
    })
    if (ownedCount !== body.roomIds.length) {
      return NextResponse.json({ error: 'Invalid room selection.' }, { status: 403 })
    }

    const instituteId = (admin as any).instituteId
    const examToCreate = { ...body, instituteId }

    await ExamModel.create(examToCreate)
    return NextResponse.json({ exam: examToCreate }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/exams]', err)
    return NextResponse.json({ error: 'Failed to create exam.' }, { status: 500 })
  }
}
