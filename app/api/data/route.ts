import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { UserModel, RoomModel, ExamModel, AttemptModel, InstituteModel } from '@/lib/models'
import { seedIfEmpty } from '@/lib/seed'
import type { AppData, User, Room, Exam, Attempt, Question, Answer, QuestionStatus } from '@/lib/exam-types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Shape converters (strip Mongo internals, never expose passwordHash) ──────

function toUser(doc: Record<string, unknown>): User {
  return {
    id: doc.id as string,
    name: doc.name as string,
    email: doc.email as string,
    password: '', // NEVER expose the hash
    role: doc.role as 'owner' | 'admin' | 'student',
    roomIds: (doc.roomIds as string[]) ?? [],
    instituteId: doc.instituteId as string | undefined,
  }
}

function toRoom(doc: Record<string, unknown>): Room {
  return {
    id: doc.id as string,
    name: doc.name as string,
    subject: doc.subject as string,
    code: doc.code as string,
    adminId: doc.adminId as string,
    memberIds: (doc.memberIds as string[]) ?? [],
    instituteId: doc.instituteId as string | undefined,
  }
}

function toQuestion(q: Record<string, unknown>): Question {
  return {
    id: q.id as string,
    section: (q.section as string) ?? 'General',
    kind: (q.kind as 'text' | 'image') ?? 'image',
    prompt: (q.prompt as string) ?? '',
    image: q.image as string | undefined,
    deleteUrl: q.deleteUrl as string | undefined,
    options: (q.options as string[]) ?? [],
    answer: Number(q.answer ?? 0),
    marks: Number(q.marks ?? 4),
    negative: Number(q.negative ?? 1),
  }
}

function toExam(doc: Record<string, unknown>): Exam {
  return {
    id: doc.id as string,
    roomIds: (doc.roomIds as string[]) ?? [],
    title: doc.title as string,
    subject: (doc.subject as string) ?? 'General',
    duration: doc.duration as number,
    published: (doc.published as boolean) ?? false,
    startsAt: doc.startsAt as string,
    endsAt: doc.endsAt as string | undefined,
    neverUnpublish: doc.neverUnpublish as boolean | undefined,
    questions: ((doc.questions as Record<string, unknown>[]) ?? []).map(toQuestion),
    instituteId: doc.instituteId as string | undefined,
  }
}

function toAttempt(doc: Record<string, unknown>): Attempt {
  return {
    id: doc.id as string,
    examId: doc.examId as string,
    userId: doc.userId as string,
    startedAt: doc.startedAt as string,
    submittedAt: doc.submittedAt as string | undefined,
    answers: ((doc.answers as Record<string, unknown>[]) ?? []).map((a) => ({
      questionId: a.questionId as string,
      option: a.option !== undefined && a.option !== null ? Number(a.option) : undefined,
      status: (a.status as QuestionStatus) ?? 'unvisited',
      seconds: Number(a.seconds ?? 0),
    })),
    score: doc.score !== undefined ? Number(doc.score) : undefined,
    correct: doc.correct !== undefined ? Number(doc.correct) : undefined,
    incorrect: doc.incorrect !== undefined ? Number(doc.incorrect) : undefined,
    instituteId: doc.instituteId as string | undefined,
  }
}

// ─── Route ───────────────────────────────────────────────────────────────────

/**
 * Returns the full AppData snapshot for the current user.
 * - Owners: see all institutes, and if instituteId query param is passed, see that institute's rooms, exams, attempts, users.
 * - Admins: see their institute's rooms, all exams in those rooms, all submitted attempts, and member users of their institute.
 * - Students: see their enrolled rooms (scoped to their institute), published exams, and their own attempts.
 */
export async function GET(request: Request) {
  try {
    await connectDB()
    await seedIfEmpty()

    const userId = await getSessionUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const dbUser = await UserModel.findOne({ id: userId }).lean()
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const instituteId = searchParams.get('instituteId')

    let rooms: Record<string, unknown>[] = []
    let exams: Record<string, unknown>[] = []
    let attempts: Record<string, unknown>[] = []
    let users: Record<string, unknown>[] = []
    let institutes: Record<string, unknown>[] = []

    if ((dbUser as Record<string, unknown>).role === 'owner') {
      institutes = (await InstituteModel.find({}).sort({ name: 1 }).lean()) as Record<string, unknown>[]
      
      if (instituteId) {
        rooms = (await RoomModel.find({ instituteId }).lean()) as Record<string, unknown>[]
        exams = (await ExamModel.find({ instituteId }).lean()) as Record<string, unknown>[]
        const examIds = exams.map((e) => e.id as string)

        attempts = (await AttemptModel.find({
          examId: { $in: examIds },
          submittedAt: { $exists: true, $ne: null },
        }).lean()) as Record<string, unknown>[]

        users = (await UserModel.find({ instituteId }).lean()) as Record<string, unknown>[]
      } else {
        users = [dbUser as Record<string, unknown>]
      }
    } else if ((dbUser as Record<string, unknown>).role === 'admin') {
      const instId = (dbUser as Record<string, unknown>).instituteId as string
      rooms = (await RoomModel.find({ instituteId: instId }).lean()) as Record<string, unknown>[]
      
      exams = (await ExamModel.find({ instituteId: instId }).lean()) as Record<string, unknown>[]
      const examIds = exams.map((e) => e.id as string)

      attempts = (await AttemptModel.find({
        examId: { $in: examIds },
        submittedAt: { $exists: true, $ne: null },
      }).lean()) as Record<string, unknown>[]

      users = (await UserModel.find({ instituteId: instId }).lean()) as Record<string, unknown>[]
    } else {
      // Student
      const instId = (dbUser as Record<string, unknown>).instituteId as string
      const userRoomIds = (dbUser as Record<string, unknown>).roomIds as string[]
      
      rooms = (await RoomModel.find({ id: { $in: userRoomIds }, instituteId: instId }).lean()) as Record<
        string,
        unknown
      >[]
      exams = (await ExamModel.find({
        roomIds: { $in: userRoomIds },
        published: true,
        instituteId: instId,
      }).lean()) as Record<string, unknown>[]
      attempts = (await AttemptModel.find({ userId, instituteId: instId }).lean()) as Record<string, unknown>[]
      users = [dbUser as Record<string, unknown>]
    }

    const appData: AppData = {
      users: users.map(toUser),
      rooms: rooms.map(toRoom),
      exams: exams.map(toExam),
      attempts: attempts.map(toAttempt),
      institutes: institutes.map((i: any) => ({
        id: i.id as string,
        name: i.name as string,
        description: i.description as string | undefined,
      })),
    }

    return NextResponse.json(appData)
  } catch (err) {
    console.error('[GET /api/data]', err)
    if (err instanceof Error && err.message.includes('MONGODB_URI')) {
      return NextResponse.json({ error: 'Database not configured. Add MONGODB_URI to .env' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Failed to load data.' }, { status: 500 })
  }
}
