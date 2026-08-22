'use client'

import { useState } from 'react'
import { Calendar, ChevronRight, Clock3, Eye, Loader2, School, Trophy } from 'lucide-react'
import type { View } from './admin-workspace'
import { AnswerSheetViewer } from './answer-sheet'
import { Empty, Heading } from './ui-bits'
import { formatDateTime, gradeAttempt, totalMarks, type AppData, type Attempt, type Exam, type User } from '@/lib/exam-types'

export type StudentOps = {
  joinRoom: (code: string) => Promise<string | null>
}

export function StudentWorkspace({
  view,
  user,
  data,
  ops,
  start,
  readOnly = false,
}: {
  view: View
  user: User
  data: AppData
  ops: StudentOps
  start: (exam: Exam) => void
  readOnly?: boolean
}) {
  const [testTab, setTestTab] = useState<'live' | 'upcoming' | 'attempted' | 'expired'>('live')
  const [inspectingAttempt, setInspectingAttempt] = useState<{
    exam: Exam
    attempt: Attempt
  } | null>(null)

  const [confirmingExam, setConfirmingExam] = useState<Exam | null>(null)
  const [confirmStep, setConfirmStep] = useState<1 | 2 | 3>(1)
  const [acceptRules, setAcceptRules] = useState(false)
  const [resultsSubject, setResultsSubject] = useState<string>('all')

  const studentInst = data.institutes?.find((inst) => inst.id === user.instituteId)

  const rooms = data.rooms.filter((room) => user.roomIds.includes(room.id))
  const allPublishedExams = data.exams.filter(
    (exam) =>
      exam.published &&
      exam.roomIds?.some((id) => user.roomIds.includes(id)) &&
      exam.questions.length > 0,
  )

  const attempts = data.attempts.filter((attempt) => attempt.userId === user.id && attempt.submittedAt)
  const [joinError, setJoinError] = useState('')
  const [joining, setJoining] = useState(false)

  const now = new Date()
  const completedExamIds = new Set(attempts.map((a) => a.examId))

  const upcomingExams = allPublishedExams.filter((exam) => {
    if (completedExamIds.has(exam.id)) return false
    return Boolean(exam.startsAt && new Date(exam.startsAt) > now)
  })

  const liveExams = allPublishedExams.filter((exam) => {
    if (completedExamIds.has(exam.id)) return false
    if (exam.startsAt && new Date(exam.startsAt) > now) return false
    if (exam.neverUnpublish || !exam.endsAt) return true
    return new Date(exam.endsAt) > now
  })

  const expiredExams = allPublishedExams.filter((exam) => {
    if (completedExamIds.has(exam.id)) return false
    if (exam.startsAt && new Date(exam.startsAt) > now) return false
    if (exam.neverUnpublish || !exam.endsAt) return false
    return new Date(exam.endsAt) <= now
  })

  const attemptedExams = allPublishedExams.filter((exam) => completedExamIds.has(exam.id))

  const handleStartClick = (exam: Exam) => {
    setConfirmingExam(exam)
    setConfirmStep(1)
    setAcceptRules(false)
  }

  const handleFinalLaunch = () => {
    if (!confirmingExam) return
    const examToLaunch = confirmingExam
    setConfirmingExam(null)
    setConfirmStep(1)
    setAcceptRules(false)
    start(examToLaunch)
  }

  const join = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const code = String(form.get('code')).trim().toUpperCase()
    if (!code) return

    setJoining(true)
    setJoinError('')
    try {
      const err = await ops.joinRoom(code)
      if (err) {
        setJoinError(err)
      } else {
        ;(event.target as HTMLFormElement).reset()
      }
    } catch {
      setJoinError('Failed to join room. Please check your connection and try again.')
    } finally {
      setJoining(false)
    }
  }

  if (view === 'rooms') {
    return (
      <>
        <Heading
          eyebrow={studentInst ? `${studentInst.name} • Classrooms` : 'Classrooms'}
          title="My enrolled classes"
        />
        {!readOnly && (
          <form onSubmit={join} className="mb-6 flex max-w-xl flex-wrap gap-3 rounded-2xl border bg-card p-4">
            <input
              name="code"
              required
              placeholder="Enter room code"
              aria-label="Room code"
              disabled={joining}
              className="min-w-40 flex-1 rounded-xl border bg-background px-4 py-3 font-mono uppercase outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            />
            <button className="btn" disabled={joining}>
              {joining ? <Loader2 size={16} className="animate-spin" /> : null}
              Join room
            </button>
            {joinError && (
              <p role="alert" className="w-full text-sm text-destructive">
                {joinError}
              </p>
            )}
          </form>
        )}
        {rooms.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {rooms.map((room) => (
              <article key={room.id} className="rounded-2xl border bg-card p-6">
                <School className="text-primary" />
                <h2 className="mt-5 text-xl font-semibold">{room.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {room.subject} · {room.memberIds.length} learners
                </p>
              </article>
            ))}
          </div>
        ) : (
          <Empty text="Ask your teacher for a room code to unlock their tests." />
        )}
      </>
    )
  }

  if (view === 'results') {
    // Only extract subjects from exams the student has actually attempted and submitted
    const attemptedSubjectSet = new Set<string>()
    const attemptedResults = attempts
      .map((attempt) => {
        const exam = data.exams.find((item) => item.id === attempt.examId)
        if (exam && exam.subject) attemptedSubjectSet.add(exam.subject)
        return { attempt, exam }
      })
      .filter((item): item is { attempt: Attempt; exam: Exam } => item.exam !== undefined)

    const attemptedSubjects = Array.from(attemptedSubjectSet)

    // Filter results strictly by selected attempted subject
    const filteredResults =
      resultsSubject === 'all'
        ? attemptedResults
        : attemptedResults.filter((r) => r.exam.subject === resultsSubject)

    // Calculate analytics only across the attempted subjects
    const totalAttemptedTests = filteredResults.length
    const totalCorrectAnswers = filteredResults.reduce((acc, r) => acc + (r.attempt.correct ?? 0), 0)
    const totalQuestionsAnswered = filteredResults.reduce((acc, r) => acc + r.exam.questions.length, 0)
    const totalMarksEarned = filteredResults.reduce((acc, r) => acc + (r.attempt.score ?? 0), 0)
    const totalMaxMarks = filteredResults.reduce((acc, r) => acc + totalMarks(r.exam), 0)
    const avgAccuracy = totalQuestionsAnswered > 0 ? Math.round((totalCorrectAnswers / totalQuestionsAnswered) * 100) : 0
    const avgScorePercent = totalMaxMarks > 0 ? Math.round((totalMarksEarned / totalMaxMarks) * 100) : 0

    return (
      <>
        {inspectingAttempt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 md:p-8">
            <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-background p-2 shadow-2xl">
              <AnswerSheetViewer
                exam={inspectingAttempt.exam}
                attempt={inspectingAttempt.attempt}
                studentName={user.name}
                instituteName={studentInst?.name}
                onClose={() => setInspectingAttempt(null)}
              />
            </div>
          </div>
        )}

        <Heading
          eyebrow={studentInst ? `${studentInst.name} • Performance & Analytics` : 'Progress & Analytics'}
          title="Your Subject Analytics"
        />

        {attemptedResults.length > 0 ? (
          <div className="space-y-6">
            {/* Subject Filter — Only showing subjects student has attempted */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Attempted Subject Filter
                </p>
                <p className="text-sm text-foreground">
                  Showing analytics for {resultsSubject === 'all' ? 'all attempted subjects' : resultsSubject}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setResultsSubject('all')}
                  className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                    resultsSubject === 'all'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'border bg-background hover:bg-muted text-muted-foreground'
                  }`}
                >
                  All Subjects ({attemptedSubjects.length})
                </button>
                {attemptedSubjects.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setResultsSubject(sub)}
                    className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                      resultsSubject === sub
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'border bg-background hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>

            {/* Subject Performance Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border bg-card p-5">
                <span className="text-xs font-medium text-muted-foreground">Tests Submitted</span>
                <p className="mt-2 text-2xl font-bold text-foreground">{totalAttemptedTests}</p>
                <span className="text-xs text-muted-foreground">in selected subject</span>
              </div>
              <div className="rounded-2xl border bg-card p-5">
                <span className="text-xs font-medium text-muted-foreground">Average Accuracy</span>
                <p className="mt-2 text-2xl font-bold text-foreground">{avgAccuracy}%</p>
                <span className="text-xs text-muted-foreground">{totalCorrectAnswers} correct of {totalQuestionsAnswered}</span>
              </div>
              <div className="rounded-2xl border bg-card p-5">
                <span className="text-xs font-medium text-muted-foreground">Total Marks Earned</span>
                <p className="mt-2 text-2xl font-bold text-foreground">
                  {totalMarksEarned} <span className="text-xs text-muted-foreground">/ {totalMaxMarks}</span>
                </p>
                <span className="text-xs text-muted-foreground">{avgScorePercent}% score aggregate</span>
              </div>
              <div className="rounded-2xl border bg-card p-5">
                <span className="text-xs font-medium text-muted-foreground">Subjects Attempted</span>
                <p className="mt-2 text-2xl font-bold text-foreground">{attemptedSubjects.length}</p>
                <span className="text-xs text-muted-foreground">Unlocked analytics</span>
              </div>
            </div>

            {/* List of Attempted Test Results */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-foreground">
                Submitted Assessments ({filteredResults.length})
              </h3>
              <div className="grid gap-4">
                {filteredResults.map(({ attempt, exam }) => (
                  <ResultCard
                    key={attempt.id}
                    attempt={attempt}
                    exam={exam}
                    onInspect={() => setInspectingAttempt({ exam, attempt })}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <Empty text="No test analytics yet. Subject analytics and solutions will automatically unlock after you complete and submit your first test." />
        )}
      </>
    )
  }

  const activeTabExams =
    testTab === 'live'
      ? liveExams
      : testTab === 'upcoming'
        ? upcomingExams
        : testTab === 'attempted'
          ? attemptedExams
          : expiredExams

  return (
    <>
      {inspectingAttempt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 md:p-8">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-background p-2 shadow-2xl">
            <AnswerSheetViewer
              exam={inspectingAttempt.exam}
              attempt={inspectingAttempt.attempt}
              studentName={user.name}
              onClose={() => setInspectingAttempt(null)}
            />
          </div>
        </div>
      )}

      {/* ── 3-Step Exam Confirmation Modal Cards ─────────────────────── */}
      {confirmingExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 md:p-6 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-3xl border bg-card p-6 md:p-8 shadow-2xl">
            <div className="mb-6 flex items-center justify-between border-b pb-4">
              <div>
                <span className="badge">
                  Step {confirmStep} of 3 Confirmation
                </span>
                <h2 className="mt-1 text-xl font-bold text-foreground">
                  {confirmStep === 1
                    ? 'Exam Details & Instructions'
                    : confirmStep === 2
                      ? 'Auto-Submit & Anti-Cheat Rules'
                      : 'Final Launch Confirmation'}
                </h2>
              </div>
              <button
                onClick={() => setConfirmingExam(null)}
                className="btn secondary py-1 text-xs"
              >
                Cancel
              </button>
            </div>

            {/* Progress indicator bar */}
            <div className="mb-6 flex gap-2">
              <div
                className={`h-2 flex-1 rounded-full ${
                  confirmStep >= 1 ? 'bg-primary' : 'bg-muted'
                }`}
              />
              <div
                className={`h-2 flex-1 rounded-full ${
                  confirmStep >= 2 ? 'bg-primary' : 'bg-muted'
                }`}
              />
              <div
                className={`h-2 flex-1 rounded-full ${
                  confirmStep >= 3 ? 'bg-primary' : 'bg-muted'
                }`}
              />
            </div>

            {/* Step 1: Exam Info Card */}
            {confirmStep === 1 && (
              <div className="flex flex-col gap-4">
                <div className="rounded-2xl border bg-muted/30 p-4">
                  <h3 className="text-lg font-bold text-foreground">{confirmingExam.title}</h3>
                  <p className="text-xs text-muted-foreground">{confirmingExam.subject}</p>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl border bg-background p-2.5">
                      <dt className="text-muted-foreground">Duration</dt>
                      <dd className="font-bold text-foreground">{confirmingExam.duration} Minutes</dd>
                    </div>
                    <div className="rounded-xl border bg-background p-2.5">
                      <dt className="text-muted-foreground">Total Questions</dt>
                      <dd className="font-bold text-foreground">{confirmingExam.questions.length}</dd>
                    </div>
                    <div className="rounded-xl border bg-background p-2.5">
                      <dt className="text-muted-foreground">Total Marks</dt>
                      <dd className="font-bold text-foreground">{totalMarks(confirmingExam)} Marks</dd>
                    </div>
                    <div className="rounded-xl border bg-background p-2.5">
                      <dt className="text-muted-foreground">Negative Marking</dt>
                      <dd className="font-bold text-foreground">Active per question</dd>
                    </div>
                  </dl>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ensure you are in a quiet room with a stable internet connection before proceeding.
                </p>
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={() => setConfirmStep(2)}
                    className="btn w-full sm:w-auto"
                  >
                    Next: Anti-Cheat Rules →
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Auto-Submission & Integrity Warning Card */}
            {confirmStep === 2 && (
              <div className="flex flex-col gap-4">
                <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 dark:bg-amber-500/15">
                  <h3 className="flex items-center gap-2 text-base font-bold text-amber-800 dark:text-amber-300">
                    ⚠️ CRITICAL TEST RULES
                  </h3>
                  <ul className="mt-3 flex flex-col gap-2 text-xs text-amber-900 dark:text-amber-200">
                    <li className="flex items-start gap-2">
                      <span className="font-bold">•</span>
                      <span>
                        <strong>Auto-Submit on Exit:</strong> Once started, if you close this browser tab, click back, or navigate away, your test will be <strong>AUTOMATICALLY SUBMITTED & LOCKED</strong> immediately.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold">•</span>
                      <span>
                        <strong>No Re-attempts:</strong> You will NOT be able to re-attempt this exam unless your teacher manually resets your attempt from the Admin panel.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold">•</span>
                      <span>
                        <strong>Timer Continues:</strong> The countdown timer runs continuously once started.
                      </span>
                    </li>
                  </ul>
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-xs">
                  <input
                    type="checkbox"
                    checked={acceptRules}
                    onChange={(e) => setAcceptRules(e.target.checked)}
                    className="mt-0.5 rounded"
                  />
                  <span className="text-foreground">
                    I understand that opening the test activates strict auto-submission rules and navigating away will lock my attempt.
                  </span>
                </label>

                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmStep(1)}
                    className="btn secondary flex-1"
                  >
                    ← Back
                  </button>
                  <button
                    disabled={!acceptRules}
                    onClick={() => setConfirmStep(3)}
                    className="btn flex-1"
                  >
                    Next: Final Step →
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Final Launch Card */}
            {confirmStep === 3 && (
              <div className="flex flex-col gap-4">
                <div className="rounded-2xl border border-primary/40 bg-primary/5 p-5 text-center">
                  <span className="text-3xl">⏱️</span>
                  <h3 className="mt-2 text-lg font-bold text-foreground">Are you 100% ready?</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Clicking the button below will immediately start the {confirmingExam.duration}-minute timer and present Question #1.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmStep(2)}
                    className="btn secondary flex-1"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleFinalLaunch}
                    className="btn flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3"
                  >
                    🚀 Start Exam Now
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <Heading
        eyebrow={
          view === 'exams'
            ? studentInst
              ? `${studentInst.name} • Assessments`
              : 'Assessments'
            : studentInst
              ? `${studentInst.name} • Student Portal`
              : 'Student Home'
        }
        title={
          view === 'exams'
            ? 'Available tests'
            : `Welcome back, ${user.name}.`
        }
      />

      {rooms.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2 rounded-xl border bg-card p-1.5 shadow-xs">
          <button
            onClick={() => setTestTab('live')}
            className={`flex-1 min-w-[120px] rounded-lg px-4 py-2.5 text-xs font-semibold transition ${
              testTab === 'live'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Live Tests ({liveExams.length})
          </button>
          <button
            onClick={() => setTestTab('upcoming')}
            className={`flex-1 min-w-[120px] rounded-lg px-4 py-2.5 text-xs font-semibold transition ${
              testTab === 'upcoming'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Upcoming ({upcomingExams.length})
          </button>
          <button
            onClick={() => setTestTab('attempted')}
            className={`flex-1 min-w-[120px] rounded-lg px-4 py-2.5 text-xs font-semibold transition ${
              testTab === 'attempted'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Attempted ({attemptedExams.length})
          </button>
          <button
            onClick={() => setTestTab('expired')}
            className={`flex-1 min-w-[120px] rounded-lg px-4 py-2.5 text-xs font-semibold transition ${
              testTab === 'expired'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Expired ({expiredExams.length})
          </button>
        </div>
      )}

      {!rooms.length ? (
        <Empty text="Join a class with your teacher's room code to unlock tests." />
      ) : activeTabExams.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {activeTabExams.map((exam) => {
            const attempt = attempts.find((a) => a.examId === exam.id)
            const resume = data.attempts.find(
              (a) => a.examId === exam.id && a.userId === user.id && !a.submittedAt,
            )
            const isUpcoming = Boolean(exam.startsAt && new Date(exam.startsAt) > now)
            const isExpired = Boolean(!isUpcoming && !exam.neverUnpublish && exam.endsAt && new Date(exam.endsAt) <= now)

            return (
              <article key={exam.id} className="rounded-2xl border bg-card p-6 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="badge">
                      {attempt
                        ? 'Completed'
                        : isUpcoming
                          ? 'Scheduled / Upcoming'
                          : isExpired
                            ? 'Expired'
                            : resume
                              ? 'In progress'
                              : 'Live now'}
                    </span>
                    {data.attempts.filter((a) => a.examId === exam.id && !a.submittedAt).length > 0 && !attempt && (
                      <span className="badge flex items-center gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        {data.attempts.filter((a) => a.examId === exam.id && !a.submittedAt).length} taking test now
                      </span>
                    )}
                  </div>
                  <Clock3 className="text-muted-foreground" />
                </div>

                <h2 className="mt-4 text-xl font-semibold">{exam.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {exam.questions.length} questions · {exam.duration} minutes · {totalMarks(exam)} marks
                </p>

                <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                  {exam.startsAt && (
                    <p className="flex items-center gap-1.5">
                      <Calendar size={13} />
                      Starts: {formatDateTime(exam.startsAt)}
                    </p>
                  )}
                  <p className="flex items-center gap-1.5">
                    <Calendar size={13} />
                    {exam.neverUnpublish || !exam.endsAt
                      ? 'Never expires'
                      : `Expires: ${formatDateTime(exam.endsAt)}`}
                  </p>
                </div>

                {attempt ? (
                  <div className="mt-4 border-t pt-4">
                    <ResultCard
                      attempt={attempt}
                      exam={exam}
                      onInspect={() => setInspectingAttempt({ exam, attempt })}
                    />
                  </div>
                ) : isUpcoming ? (
                  <button
                    disabled
                    className="btn secondary mt-5 w-full justify-center opacity-70 cursor-not-allowed"
                  >
                    Locked — Starts at {formatDateTime(exam.startsAt)}
                  </button>
                ) : (
                  <button
                    disabled={isExpired || readOnly}
                    onClick={() => handleStartClick(exam)}
                    className="btn mt-5 w-full justify-center gap-2"
                  >
                    {isExpired
                      ? 'Test Expired'
                      : readOnly
                        ? 'Start assessment (disabled in view-only)'
                        : resume
                          ? 'Resume test'
                          : 'Start assessment'}
                    {!isExpired && !readOnly && <ChevronRight size={17} />}
                  </button>
                )}
              </article>
            )
          })}
        </div>
      ) : (
        <Empty
          text={
            testTab === 'live'
              ? 'No live tests available right now.'
              : testTab === 'upcoming'
                ? 'No scheduled upcoming tests.'
                : testTab === 'attempted'
                  ? 'You have not submitted any tests yet.'
                  : 'No expired tests.'
          }
        />
      )}
    </>
  )
}

function ResultCard({
  attempt,
  exam,
  onInspect,
}: {
  attempt: Attempt
  exam: Exam
  onInspect?: () => void
}) {
  const grade = gradeAttempt(exam, attempt)
  return (
    <article className="rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="badge">Submitted Result</span>
          <h2 className="mt-2 text-lg font-semibold">{exam.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {grade.correct} correct · {grade.incorrect} incorrect · {grade.accuracy}% accuracy
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold">
            {grade.score}
            <span className="text-xs text-muted-foreground"> / {totalMarks(exam)}</span>
          </p>
          <span className="text-xs text-muted-foreground">Total score</span>
        </div>
      </div>
      {onInspect && (
        <button
          type="button"
          onClick={onInspect}
          className="btn secondary mt-4 w-full justify-center gap-2 py-2 text-xs font-semibold"
        >
          <Eye size={14} /> Review Solutions & Answer Sheet
        </button>
      )}
    </article>
  )
}
