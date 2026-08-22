import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { AttemptModel, UserModel } from '@/lib/models'
import type { Attempt } from '@/lib/exam-types'

/**
 * Upserts an exam attempt.
 * Used both for in-progress autosave and final submission.
 */
export async function POST(request: Request) {
  try {
    const sessionUserId = await getSessionUserId()
    if (!sessionUserId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const body = (await request.json().catch(() => null)) as Attempt | null
    if (!body?.id || !body?.examId || !body?.startedAt) {
      return NextResponse.json({ error: 'Invalid attempt data.' }, { status: 400 })
    }

    await connectDB()

    const dbUser = await UserModel.findOne({ id: sessionUserId }).lean()
    if (!dbUser) return NextResponse.json({ error: 'User not found.' }, { status: 404 })

    const role = (dbUser as Record<string, unknown>).role as string
    const targetUserId = body.userId || sessionUserId

    // Allow owners/admins to save attempts for any user; students can save for themselves
    if (role !== 'owner' && role !== 'admin' && targetUserId !== sessionUserId) {
      return NextResponse.json({ error: 'Attempt userId does not match your session.' }, { status: 403 })
    }

    const targetInstId = body.instituteId || (dbUser as Record<string, unknown>).instituteId

    // Check if attempt already exists in DB to prevent out-of-order autosaves from overwriting final submissions
    const existingAttempt = await AttemptModel.findOne({ id: body.id }).lean()
    let finalSubmittedAt = body.submittedAt ?? null
    if (existingAttempt && (existingAttempt as Record<string, unknown>).submittedAt && !body.submittedAt) {
      finalSubmittedAt = (existingAttempt as Record<string, unknown>).submittedAt as string
    }

    await AttemptModel.findOneAndUpdate(
      { id: body.id },
      {
        $set: {
          examId: body.examId,
          userId: targetUserId,
          startedAt: body.startedAt,
          submittedAt: finalSubmittedAt,
          answers: body.answers ?? [],
          score: body.score,
          correct: body.correct,
          incorrect: body.incorrect,
          instituteId: targetInstId,
          tabSwitchCount: body.tabSwitchCount ?? 0,
          fullscreenExitCount: body.fullscreenExitCount ?? 0,
          cheatWarningCount: body.cheatWarningCount ?? 0,
          lastPingAt: new Date().toISOString(),
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
