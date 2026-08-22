import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { UserModel, RoomModel, ExamModel, AttemptModel } from '@/lib/models'
import type { Exam } from '@/lib/exam-types'

/** Verifies the exam belongs to a room owned by the authenticated admin, or any exam if owner. */
async function getAccessibleExam(examId: string, user: Record<string, unknown>) {
  if (user.role === 'owner') {
    return ExamModel.findOne({ id: examId }).lean()
  }
  const adminRooms = await RoomModel.find({
    $or: [{ adminId: user.id }, { instituteId: user.instituteId as string }],
  }).lean()
  const adminRoomIds = (adminRooms as Record<string, unknown>[]).map((r) => r.id as string)
  return ExamModel.findOne({ id: examId, roomIds: { $in: adminRoomIds } }).lean()
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

    const exam = await getAccessibleExam(id, user as Record<string, unknown>)
    if (!exam) return NextResponse.json({ error: 'Exam not found.' }, { status: 404 })

    const changes = await request.json().catch(() => null) as Partial<Exam> | null
    if (!changes || Object.keys(changes).length === 0) {
      return NextResponse.json({ error: 'No changes provided.' }, { status: 400 })
    }

    // Check if active attempts are currently in progress
    const activeAttemptExists = await AttemptModel.exists({
      examId: id,
      $or: [{ submittedAt: { $exists: false } }, { submittedAt: null }],
    })
    if (activeAttemptExists) {
      return NextResponse.json(
        { error: 'This exam is currently being attempted by students and cannot be modified or deleted.' },
        { status: 400 },
      )
    }

    // Sanitize: strip fields that must not change via PATCH
    const { id: _id, roomIds: _roomIds, ...safe } = changes as Record<string, unknown>

    await ExamModel.updateOne({ id }, { $set: safe })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/exams/[id]]', err)
    return NextResponse.json({ error: 'Failed to update exam.' }, { status: 500 })
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

    const exam = await getAccessibleExam(id, user as Record<string, unknown>)
    if (!exam) return NextResponse.json({ error: 'Exam not found.' }, { status: 404 })

    // Check if active attempts are currently in progress
    const activeAttemptInDelete = await AttemptModel.exists({
      examId: id,
      $or: [{ submittedAt: { $exists: false } }, { submittedAt: null }],
    })
    if (activeAttemptInDelete) {
      return NextResponse.json(
        { error: 'This exam is currently being attempted by students and cannot be deleted.' },
        { status: 400 },
      )
    }

    // Collect ImgBB delete URLs so the client can clean them up
    const deleteUrls = ((exam as Record<string, unknown>).questions as Record<string, unknown>[])
      ?.filter((q) => q.deleteUrl)
      .map((q) => q.deleteUrl as string) ?? []

    await Promise.all([
      ExamModel.deleteOne({ id }),
      AttemptModel.deleteMany({ examId: id }),
    ])

    return NextResponse.json({ ok: true, deleteUrls })
  } catch (err) {
    console.error('[DELETE /api/exams/[id]]', err)
    return NextResponse.json({ error: 'Failed to delete exam.' }, { status: 500 })
  }
}
