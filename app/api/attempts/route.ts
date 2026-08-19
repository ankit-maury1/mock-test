import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { AttemptModel } from '@/lib/models'
import type { Attempt } from '@/lib/exam-types'

/**
 * Upserts an exam attempt.
 * Used both for in-progress autosave and final submission.
 * The userId from the session is authoritative — body.userId is validated against it.
 */
export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const body = await request.json().catch(() => null) as Attempt | null
    if (!body?.id || !body?.examId || !body?.startedAt) {
      return NextResponse.json({ error: 'Invalid attempt data.' }, { status: 400 })
    }

    // Prevent impersonation: session userId must match attempt userId
    if (body.userId !== userId) {
      return NextResponse.json({ error: 'Attempt userId does not match your session.' }, { status: 403 })
    }

    await connectDB()

    await AttemptModel.findOneAndUpdate(
      { id: body.id },
      {
        $set: {
          examId: body.examId,
          userId,
          startedAt: body.startedAt,
          submittedAt: body.submittedAt ?? null,
          answers: body.answers ?? [],
          score: body.score,
          correct: body.correct,
          incorrect: body.incorrect,
        },
      },
      { upsert: true },
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/attempts]', err)
    return NextResponse.json({ error: 'Failed to save attempt.' }, { status: 500 })
  }
}
