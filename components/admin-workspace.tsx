'use client'

import { useState } from 'react'
import { Calendar, ChevronDown, ChevronUp, Eye, Loader2, Pencil, Plus, RotateCcw, Trash2, Users } from 'lucide-react'
import { ExamCreator, ExamQuestionManager } from './exam-builder'
import { AnswerSheetViewer } from './answer-sheet'
import { Empty, Field, Heading, Stat } from './ui-bits'
import { deleteQuestionImage } from '@/lib/imgbb'
import {
  formatDateTime,
  gradeAttempt,
  totalMarks,
  type AppData,
  type Attempt,
  type Exam,
  type Question,
  type Room,
  type User,
} from '@/lib/exam-types'

export type View = 'dashboard' | 'rooms' | 'exams' | 'results' | 'students' | 'people' | 'institutes'

export type AdminOps = {
  addRoom: (name: string, subject: string) => Promise<string | null>
  addExam: (exam: Exam) => Promise<string | null>
  updateExam: (id: string, changes: Partial<Exam>) => Promise<string | null>
  deleteExam: (id: string) => Promise<string | null>
  addUser: (name: string, email: string, password: string, role: 'admin' | 'student') => Promise<string | null>
  updateUser: (
    id: string,
    name: string,
    email: string,
    password?: string,
  ) => Promise<string | null>
  deleteUser: (id: string) => Promise<string | null>
  toggleRoomMember: (studentId: string, roomId: string, joined: boolean) => Promise<string | null>
  resetAttempt: (attemptId: string) => Promise<string | null>
}

export function AdminWorkspace({
  view,
  user,
  data,
  ops,
  readOnly = false,
  onImpersonate,
}: {
  view: View
  user: User
  data: AppData
  ops: AdminOps
  readOnly?: boolean
  onImpersonate?: (user: User) => void
}) {
  const rooms = user.role === 'owner' ? data.rooms : data.rooms.filter((room) => room.adminId === user.id)
  const exams = user.role === 'owner' ? data.exams : data.exams.filter((exam) =>
    rooms.some((room) => exam.roomIds?.includes(room.id)),
  )
  const attempts = data.attempts.filter(
    (attempt) => exams.some((exam) => exam.id === attempt.examId) && attempt.submittedAt,
  )
  const activeAttempts = data.attempts.filter(
    (attempt) => exams.some((exam) => exam.id === attempt.examId) && !attempt.submittedAt,
  )
  const [showRoomForm, setShowRoomForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editingExpiryExamId, setEditingExpiryExamId] = useState<string | null>(null)
  const [expiryEndsAt, setExpiryEndsAt] = useState('')
  const [expiryNever, setExpiryNever] = useState(true)
  const [opError, setOpError] = useState('')
  const [working, setWorking] = useState(false)
  const [examTab, setExamTab] = useState<'all' | 'live' | 'draft' | 'expired'>('all')
  const [expandedSubmissionsExamId, setExpandedSubmissionsExamId] = useState<string | null>(null)
  const [inspectingAttempt, setInspectingAttempt] = useState<{
    exam: Exam
    attempt: Attempt
    studentName: string
  } | null>(null)
  const [resettingAttemptId, setResettingAttemptId] = useState<string | null>(null)

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [selectedSubmissionsExamId, setSelectedSubmissionsExamId] = useState<string | null>(null)
  const [resultsRoomId, setResultsRoomId] = useState<string>('all')
  const [resultsSubject, setResultsSubject] = useState<string>('all')

  const handleOp = async (fn: () => Promise<string | null>): Promise<string | null> => {
    setWorking(true)
    setOpError('')
    try {
      const err = await fn()
      if (err) setOpError(err)
      return err
    } catch {
      const err = 'Something went wrong. Please try again.'
      setOpError(err)
      return err
    } finally {
      setWorking(false)
    }
  }

  const addRoom = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const fd = new FormData(form)
    const name = String(fd.get('name') || '').trim()
    const subject = String(fd.get('subject') || '').trim()
    if (!name || !subject) return
    const err = await handleOp(() => ops.addRoom(name, subject))
    if (!err) {
      form.reset()
      setShowRoomForm(false)
    }
  }

  const updateExam = async (examId: string, changes: Partial<Exam>) =>
    handleOp(() => ops.updateExam(examId, changes))

  const setQuestions = (examId: string, questions: Question[]) =>
    updateExam(examId, { questions })

  const handleSaveExpiry = async (examId: string) => {
    await updateExam(examId, {
      neverUnpublish: expiryNever,
      endsAt: expiryNever ? undefined : expiryEndsAt ? new Date(expiryEndsAt).toISOString() : undefined,
    })
    setEditingExpiryExamId(null)
  }

  const handleResetAttempt = async (attempt: Attempt, studentName: string) => {
    if (
      !window.confirm(
        `Are you sure you want to reset the test score for ${studentName}? This will delete their attempt and allow them to re-take the exam.`,
      )
    ) {
      return
    }
    setResettingAttemptId(attempt.id)
    try {
      await ops.resetAttempt(attempt.id)
    } finally {
      setResettingAttemptId(null)
    }
  }

  if (view === 'rooms') {
    return (
      <>
        <Heading
          eyebrow="Organization"
          title="Your learning rooms"
          action={
            rooms.length ? (
              <button onClick={() => setShowRoomForm(!showRoomForm)} className="btn">
                <Plus size={17} /> New room
              </button>
            ) : undefined
          }
        />
        {opError && (
          <p role="alert" className="mb-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {opError}
          </p>
        )}
        {showRoomForm && (
          <form
            onSubmit={addRoom}
            className="mb-6 grid gap-4 rounded-2xl border bg-card p-5 md:grid-cols-[1fr_1fr_auto]"
          >
            <Field label="Room name" name="name" placeholder="Physics Cohort B" required />
            <Field label="Subject" name="subject" placeholder="Physics" required />
            <button className="btn self-end" disabled={working}>
              {working ? <Loader2 size={16} className="animate-spin" /> : null}
              Create room
            </button>
          </form>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          {rooms.map((room) => (
            <article key={room.id} className="rounded-2xl border bg-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold">{room.name}</p>
                  <p className="text-sm text-muted-foreground">{room.subject}</p>
                </div>
                <span className="badge">{room.memberIds.length} students</span>
              </div>
              <div className="mt-8 rounded-xl bg-muted p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Join code</p>
                <p className="mt-1 font-mono text-2xl font-semibold tracking-[.2em]">{room.code}</p>
              </div>
            </article>
          ))}
        </div>
      </>
    )
  }

  if (view === 'exams') {
    const selectedRoom = rooms.find((r) => r.id === selectedRoomId)
    const selectedSubmissionsExam = exams.find((e) => e.id === selectedSubmissionsExamId)

    // Answer Sheet Modal
    const answerSheetModal = inspectingAttempt && (
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 md:p-8">
        <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-background p-2 shadow-2xl">
          <AnswerSheetViewer
            exam={inspectingAttempt.exam}
            attempt={inspectingAttempt.attempt}
            studentName={inspectingAttempt.studentName}
            onClose={() => setInspectingAttempt(null)}
          />
        </div>
      </div>
    )

    // LEVEL 3: DEDICATED SUBMISSIONS PAGE FOR A SPECIFIC EXAM
    if (selectedSubmissionsExam) {
      const examAttempts = data.attempts
        .filter((a) => a.examId === selectedSubmissionsExam.id)
        .sort((a, b) => {
          const subA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0
          const subB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0
          if (subB !== subA) return subB - subA

          const scoreA = a.score ?? 0
          const scoreB = b.score ?? 0
          return scoreB - scoreA
        })

      return (
        <>
          {answerSheetModal}
          <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <button
              onClick={() => {
                setSelectedSubmissionsExamId(null)
              }}
              className="hover:text-foreground hover:underline"
            >
              Exams
            </button>
            {selectedRoom && (
              <>
                <span>/</span>
                <button
                  onClick={() => setSelectedSubmissionsExamId(null)}
                  className="hover:text-foreground hover:underline"
                >
                  {selectedRoom.name}
                </button>
              </>
            )}
            <span>/</span>
            <span className="font-medium text-foreground">{selectedSubmissionsExam.title} Submissions</span>
          </div>

          <Heading
            eyebrow={`Submissions · ${selectedSubmissionsExam.subject}`}
            title={selectedSubmissionsExam.title}
            action={
              <button
                onClick={() => setSelectedSubmissionsExamId(null)}
                className="btn secondary"
              >
                Back to exams
              </button>
            }
          />

          <div className="mt-6 rounded-2xl border bg-card p-6">
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-lg font-semibold">
                Student Submissions ({examAttempts.length})
              </h2>
              <span className="text-xs text-muted-foreground">
                Ranked by score & faster completion time
              </span>
            </div>

            {examAttempts.length ? (
              <div className="mt-4 flex flex-col gap-3">
                {examAttempts.map((attempt, index) => {
                  const student = data.users.find((u) => u.id === attempt.userId)
                  const studentName = student?.name ?? 'Unknown Student'
                  const isResetting = resettingAttemptId === attempt.id
                  const totalTimeSec = attempt.answers.reduce((sum, ans) => sum + (ans.seconds || 0), 0)
                  const minutes = Math.floor(totalTimeSec / 60)
                  const seconds = totalTimeSec % 60

                  return (
                    <div
                      key={attempt.id}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-muted/30 p-4 text-sm"
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-bold text-muted-foreground">
                          #{index + 1}
                        </span>
                        <div>
                          <p className="font-semibold">{studentName}</p>
                          <p className="text-xs text-muted-foreground">
                            {student?.email ?? '—'} ·{' '}
                            {attempt.submittedAt
                              ? `Submitted ${formatDateTime(attempt.submittedAt)}`
                              : 'In progress'}
                            {totalTimeSec > 0 && ` (${minutes}m ${seconds}s taken)`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {attempt.submittedAt ? (
                          <span className="badge font-bold">
                            {gradeAttempt(selectedSubmissionsExam, attempt).score} / {totalMarks(selectedSubmissionsExam)} pts
                          </span>
                        ) : (
                          <span className="badge border-amber-500/40 bg-amber-500/10 text-amber-600">
                            In progress
                          </span>
                        )}
                        {attempt.submittedAt && (
                          <button
                            onClick={() =>
                              setInspectingAttempt({
                                exam: selectedSubmissionsExam,
                                attempt,
                                studentName,
                              })
                            }
                            className="btn secondary py-1.5 text-xs"
                            title="Inspect solutions and answer sheet"
                          >
                            <Eye size={14} /> Solutions
                          </button>
                        )}
                        <button
                          onClick={() => handleResetAttempt(attempt, studentName)}
                          disabled={isResetting}
                          className="btn secondary border-destructive/30 text-destructive hover:bg-destructive/10 py-1.5 text-xs"
                          title="Reset attempt score"
                        >
                          {isResetting ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <RotateCcw size={14} />
                          )}
                          Reset
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No students have submitted solutions for this exam yet.
              </p>
            )}
          </div>
        </>
      )
    }

    // LEVEL 1: ROOM SELECTION LIST (IF NO ROOM IS CLICKED YET)
    if (!selectedRoomId) {
      return (
        <>
          <Heading
            eyebrow="Assessment studio"
            title="Exams by Room"
            action={
              rooms.length ? (
                <button onClick={() => setCreating(!creating)} className="btn">
                  <Plus size={17} /> New exam
                </button>
              ) : undefined
            }
          />
          {!rooms.length && <Empty text="Create a room first — exams belong to a room." />}

          <p className="mb-6 text-sm text-muted-foreground">
            Select a room below to view, manage, and inspect exams and student submissions for that room.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => {
              const roomExams = exams.filter((e) => e.roomIds?.includes(room.id))
              const liveRoomExams = roomExams.filter((e) => e.published)
              return (
                <article
                  key={room.id}
                  onClick={() => setSelectedRoomId(room.id)}
                  className="group cursor-pointer rounded-2xl border bg-card p-6 transition-all hover:border-primary hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="badge">{room.subject}</span>
                      <h3 className="mt-2 text-xl font-bold group-hover:text-primary transition-colors">
                        {room.name}
                      </h3>
                    </div>
                    <span className="badge border-primary/30 bg-primary/10 text-primary">
                      {room.memberIds.length} students
                    </span>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
                    <div>
                      <span className="font-semibold text-foreground">{roomExams.length}</span> Total Exams
                    </div>
                    <div>
                      <span className="font-semibold text-emerald-600">{liveRoomExams.length}</span> Live Exams
                    </div>
                    <span className="font-medium text-primary group-hover:underline">
                      View exams &rarr;
                    </span>
                  </div>
                </article>
              )
            })}
          </div>

          <div className="mt-8 border-t pt-6">
            <button
              onClick={() => setSelectedRoomId('all')}
              className="btn secondary text-xs"
            >
              Show all exams across all rooms ({exams.length})
            </button>
          </div>
        </>
      )
    }

    // LEVEL 2: EXAMS LIST FOR THE SELECTED ROOM
    const filteredExams =
      selectedRoomId === 'all'
        ? exams
        : exams.filter((e) => e.roomIds?.includes(selectedRoomId))

    const now = new Date()
    const liveExams = filteredExams.filter(
      (e) => e.published && (e.neverUnpublish || !e.endsAt || new Date(e.endsAt) > now),
    )
    const draftExams = filteredExams.filter((e) => !e.published)
    const expiredExams = filteredExams.filter(
      (e) => e.published && !e.neverUnpublish && e.endsAt && new Date(e.endsAt) <= now,
    )

    const displayedExams =
      examTab === 'live'
        ? liveExams
        : examTab === 'draft'
          ? draftExams
          : examTab === 'expired'
            ? expiredExams
            : filteredExams

    return (
      <>
        {answerSheetModal}

        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <button
            onClick={() => setSelectedRoomId(null)}
            className="hover:text-foreground hover:underline"
          >
            Rooms
          </button>
          <span>/</span>
          <span className="font-medium text-foreground">
            {selectedRoom ? selectedRoom.name : 'All Rooms'}
          </span>
        </div>

        <Heading
          eyebrow={selectedRoom ? `Room · ${selectedRoom.subject}` : 'All Rooms'}
          title={selectedRoom ? `${selectedRoom.name} Exams` : 'All Exams'}
          action={
            rooms.length ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedRoomId(null)}
                  className="btn secondary"
                >
                  Change room
                </button>
                <button onClick={() => setCreating(!creating)} className="btn">
                  <Plus size={17} /> New exam
                </button>
              </div>
            ) : undefined
          }
        />

        <div className="mb-6 flex gap-2 rounded-xl border bg-card p-1">
          <button
            onClick={() => setExamTab('all')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              examTab === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All ({filteredExams.length})
          </button>
          <button
            onClick={() => setExamTab('live')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              examTab === 'live'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Live ({liveExams.length})
          </button>
          <button
            onClick={() => setExamTab('draft')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              examTab === 'draft'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Drafts ({draftExams.length})
          </button>
          <button
            onClick={() => setExamTab('expired')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              examTab === 'expired'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Expired ({expiredExams.length})
          </button>
        </div>

        {opError && (
          <p role="alert" className="mb-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {opError}
          </p>
        )}
        {creating && rooms.length > 0 && (
          <div className="mb-6">
            <ExamCreator
              rooms={rooms}
              onCancel={() => setCreating(false)}
              onCreate={async (exam) => {
                await handleOp(() => ops.addExam(exam))
                setCreating(false)
              }}
            />
          </div>
        )}

        <div className="grid gap-4">
          {displayedExams.map((exam) => {
            const activeTakers = data.attempts.filter(
              (a) => a.examId === exam.id && !a.submittedAt,
            ).length
            const examAttempts = data.attempts.filter((a) => a.examId === exam.id)
            const isEditingExpiry = editingExpiryExamId === exam.id

            return (
              <article key={exam.id} className="rounded-2xl border bg-card p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="badge">{exam.published ? 'Published' : 'Draft'}</span>
                      {activeTakers > 0 && (
                        <span className="badge flex items-center gap-1 border-primary/40 bg-primary/10 text-primary">
                          <Users size={13} /> {activeTakers} student{activeTakers === 1 ? '' : 's'} taking test now
                        </span>
                      )}
                    </div>
                    <h2 className="mt-3 text-xl font-semibold">{exam.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {exam.subject} · {exam.duration} minutes · {totalMarks(exam)} marks ·{' '}
                      {exam.roomIds
                        ?.map((id) => data.rooms.find((room) => room.id === id)?.name)
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar size={13} />
                      {exam.neverUnpublish || !exam.endsAt
                        ? 'Never expires'
                        : `Expires: ${new Date(exam.endsAt).toLocaleString()}`}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setSelectedSubmissionsExamId(exam.id)}
                      className="btn secondary border-primary/40 text-primary hover:bg-primary/10"
                    >
                      <Users size={16} /> View Submissions ({examAttempts.length})
                    </button>
                    {!readOnly && (
                      <>
                        <button
                          onClick={() => {
                            if (isEditingExpiry) {
                              setEditingExpiryExamId(null)
                            } else {
                              setEditingExpiryExamId(exam.id)
                              setExpiryNever(Boolean(exam.neverUnpublish))
                              setExpiryEndsAt(
                                exam.endsAt
                                  ? new Date(exam.endsAt).toISOString().slice(0, 16)
                                  : '',
                              )
                            }
                          }}
                          title="Edit Expiry / Settings"
                          className="btn secondary"
                        >
                          <Calendar size={16} /> Expiry settings
                        </button>
                        <button
                          onClick={() =>
                            handleOp(async () => {
                              if (
                                !window.confirm(
                                  `Are you sure you want to ${exam.published ? 'unpublish' : 'publish'} this exam?`,
                                )
                              )
                                return null
                              return ops.updateExam(exam.id, { published: !exam.published })
                            })
                          }
                          disabled={!exam.questions.length || working}
                          title={exam.questions.length ? undefined : 'Add a question before publishing'}
                          className="btn secondary"
                        >
                          {exam.published ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          aria-label={`Delete ${exam.title}`}
                          onClick={() =>
                            handleOp(async () => {
                              if (!window.confirm('Are you sure you want to delete this exam?')) return null
                              // Fire-and-forget: delete all ImgBB images for questions in this exam
                              exam.questions.forEach((q) => {
                                if (q.deleteUrl) deleteQuestionImage(q.deleteUrl)
                              })
                              return ops.deleteExam(exam.id)
                            })
                          }
                          disabled={working}
                          className="grid size-10 place-items-center rounded-xl border text-muted-foreground hover:text-destructive disabled:opacity-40"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isEditingExpiry && (
                  <div className="mt-4 rounded-xl border bg-muted/40 p-4">
                    <p className="mb-3 text-sm font-semibold">Edit Expiry & Unpublish Settings</p>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={expiryNever}
                          onChange={(e) => setExpiryNever(e.target.checked)}
                          className="rounded"
                        />
                        Never unpublish
                      </label>
                      {!expiryNever && (
                        <input
                          type="datetime-local"
                          value={expiryEndsAt}
                          onChange={(e) => setExpiryEndsAt(e.target.value)}
                          className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                        />
                      )}
                      <div className="flex gap-2 sm:ml-auto">
                        <button
                          type="button"
                          onClick={() => setEditingExpiryExamId(null)}
                          className="btn secondary py-1 text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveExpiry(exam.id)}
                          className="btn py-1 text-xs"
                          disabled={working}
                        >
                          Save Expiry
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <ExamQuestionManager
                  exam={exam}
                  onChange={(questions) => setQuestions(exam.id, questions)}
                  readOnly={readOnly}
                />
              </article>
            )
          })}
        </div>
        {!displayedExams.length && rooms.length > 0 && !creating && (
          <Empty text="No exams found in this room or category." />
        )}
      </>
    )
  }

  if (view === 'results') {
    const roomFilteredExams =
      resultsRoomId === 'all'
        ? exams
        : exams.filter((e) => e.roomIds?.includes(resultsRoomId))

    const availableSubjects = Array.from(
      new Set(roomFilteredExams.map((e) => e.subject).filter(Boolean)),
    )

    const filteredExams =
      resultsSubject === 'all'
        ? roomFilteredExams
        : roomFilteredExams.filter((e) => e.subject === resultsSubject)

    const filteredExamIds = new Set(filteredExams.map((e) => e.id))
    const filteredAttempts = attempts.filter((a) => filteredExamIds.has(a.examId))

    const scored = filteredAttempts.map((attempt) => {
      const exam = data.exams.find((item) => item.id === attempt.examId)!
      return { attempt, exam, grade: gradeAttempt(exam, attempt) }
    })
    const average = scored.length
      ? Math.round(scored.reduce((sum, item) => sum + item.grade.score, 0) / scored.length)
      : 0
    return (
      <>
        <Heading eyebrow="Performance" title="Exam-wise Analytics & Rankings" />

        {/* Top Room & Subject Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex flex-1 min-w-[200px] flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Filter by Room
            </label>
            <select
              value={resultsRoomId}
              onChange={(e) => {
                setResultsRoomId(e.target.value)
                setResultsSubject('all')
              }}
              className="rounded-xl border bg-background px-3 py-2 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Rooms ({rooms.length})</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name} ({room.subject})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-1 min-w-[200px] flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Filter by Subject
            </label>
            <select
              value={resultsSubject}
              onChange={(e) => setResultsSubject(e.target.value)}
              className="rounded-xl border bg-background px-3 py-2 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Subjects ({availableSubjects.length})</option>
              {availableSubjects.map((subj) => (
                <option key={subj} value={subj}>
                  {subj}
                </option>
              ))}
            </select>
          </div>

          {(resultsRoomId !== 'all' || resultsSubject !== 'all') && (
            <button
              onClick={() => {
                setResultsRoomId('all')
                setResultsSubject('all')
              }}
              className="btn secondary self-end py-2 text-xs"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Stat label="Average score" value={scored.length ? average : '—'} note="Across filtered attempts" />
          <Stat label="Total Submissions" value={scored.length} note="Completed attempts in selection" />
        </div>

        {filteredExams.length ? (
          <div className="mt-8 flex flex-col gap-6">
            {filteredExams.map((exam) => {
              const examAttempts = attempts.filter((a) => a.examId === exam.id)
              return (
                <section key={exam.id} className="rounded-2xl border bg-card p-6 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-4">
                    <div>
                      <h2 className="text-lg font-semibold">{exam.title}</h2>
                      <p className="text-xs text-muted-foreground">
                        {exam.subject} · {totalMarks(exam)} total marks
                      </p>
                    </div>
                    <span className="badge">
                      {examAttempts.length} submission{examAttempts.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  {examAttempts.length ? (
                    <Leaderboard
                      attempts={examAttempts}
                      data={data}
                      exam={exam}
                    />
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">
                      No submissions recorded yet for this exam.
                    </p>
                  )}
                </section>
              )
            })}
          </div>
        ) : (
          <div className="mt-6">
            <Empty text="No exams or analytics match the selected Room and Subject filters." />
          </div>
        )}
      </>
    )
  }

  if (view === 'students' || view === 'people') {
    return (
      <PeopleView
        data={data}
        ops={ops}
        rooms={rooms}
        user={user}
        readOnly={readOnly}
        onImpersonate={onImpersonate}
      />
    )
  }

  return (
    <>
      <Heading eyebrow="Admin overview" title={`Welcome back, ${user.name.split(' ')[0]}.`} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Active rooms" value={rooms.length} note="Across your organization" />
        <Stat
          label="Published exams"
          value={exams.filter((exam) => exam.published).length}
          note="Visible to joined students"
        />
        <Stat
          label="Students"
          value={rooms.reduce((count, room) => count + room.memberIds.length, 0)}
          note="Room memberships"
        />
        <Stat
          label="Live Takers"
          value={activeAttempts.length}
          note="Currently taking tests"
        />
        <Stat label="Submissions" value={attempts.length} note="Ready for analysis" />
      </div>
      <section className="mt-8 rounded-2xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Recent activity</h2>
        {attempts.length ? (
          <div className="mt-5 flex flex-col gap-4">
            {attempts.map((attempt) => (
              <div
                key={attempt.id}
                className="flex items-center justify-between gap-4 border-b pb-4 last:border-0 last:pb-0"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {data.users.find((item) => item.id === attempt.userId)?.name} submitted a test
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {data.exams.find((item) => item.id === attempt.examId)?.title}
                  </p>
                </div>
                <span className="badge">{attempt.score} pts</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No submissions yet. Share a room code to get started.
          </p>
        )}
      </section>
    </>
  )
}

function Leaderboard({
  attempts,
  data,
  exam,
}: {
  attempts: Attempt[]
  data: AppData
  exam?: Exam
}) {
  const [showAll, setShowAll] = useState(false)

  // Tie-breaker logic:
  // Primary: Score descending (higher marks get higher rank)
  // Secondary: Total time spent ascending (less time consumed = submitted faster = higher rank)
  // Tertiary: SubmittedAt timestamp ascending (earlier submission timestamp = higher rank)
  const sorted = [...attempts].sort((a, b) => {
    const scoreA = a.score ?? 0
    const scoreB = b.score ?? 0
    if (scoreB !== scoreA) return scoreB - scoreA

    const timeA = a.answers.reduce((acc, ans) => acc + (ans.seconds || 0), 0)
    const timeB = b.answers.reduce((acc, ans) => acc + (ans.seconds || 0), 0)
    if (timeA !== timeB) return timeA - timeB

    const subA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0
    const subB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0
    return subA - subB
  })

  const displayedAttempts = showAll ? sorted : sorted.slice(0, 10)

  // Check if score is tied with adjacent attempts for tie-breaker badge display
  const isTiedScore = (idx: number) => {
    const currentScore = sorted[idx]?.score ?? 0
    const prevScore = sorted[idx - 1]?.score
    const nextScore = sorted[idx + 1]?.score
    return (prevScore !== undefined && currentScore === prevScore) || (nextScore !== undefined && currentScore === nextScore)
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground">
        <span>Ranked by marks. Identical scores are tie-broken by fastest completion time.</span>
        <span className="font-medium">Showing {displayedAttempts.length} of {sorted.length} students</span>
      </div>

      <div className="flex flex-col gap-2">
        {displayedAttempts.map((attempt, position) => {
          const student = data.users.find((item) => item.id === attempt.userId)
          const studentName = student?.name ?? 'Unknown Student'
          const totalTimeSec = attempt.answers.reduce((sum, ans) => sum + (ans.seconds || 0), 0)
          const minutes = Math.floor(totalTimeSec / 60)
          const seconds = totalTimeSec % 60
          const rank = position + 1
          const tied = isTiedScore(position)

          const rankBadge =
            rank === 1 ? (
              <span className="flex items-center gap-1.5 rounded-lg border border-amber-400/60 bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300 shadow-sm shrink-0">
                🥇 1st Place
              </span>
            ) : rank === 2 ? (
              <span className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 shrink-0">
                🥈 2nd Place
              </span>
            ) : rank === 3 ? (
              <span className="flex items-center gap-1.5 rounded-lg border border-amber-700/40 bg-amber-800/15 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-400 shrink-0">
                🥉 3rd Place
              </span>
            ) : (
              <span className="flex size-8 items-center justify-center rounded-full bg-muted font-mono text-xs font-bold text-muted-foreground shrink-0">
                #{rank}
              </span>
            )

          return (
            <div
              key={attempt.id}
              className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-3.5 transition-colors ${
                rank === 1
                  ? 'border-amber-500/40 bg-amber-500/10 shadow-sm dark:bg-amber-500/15'
                  : rank === 2
                    ? 'border-slate-300/80 bg-slate-500/5 dark:border-slate-700'
                    : rank === 3
                      ? 'border-amber-800/30 bg-amber-900/10 dark:border-amber-700/40'
                      : 'bg-card'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {rankBadge}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-sm truncate text-foreground">{studentName}</p>
                    {tied && (
                      <span
                        title="Score tied with another student — ranked higher due to faster completion time"
                        className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 border border-amber-500/30"
                      >
                        ⚡ Won by faster completion
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {student?.email ?? '—'}
                    {totalTimeSec > 0 && ` · Time spent: ${minutes}m ${seconds}s`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-bold text-sm text-foreground">
                  {attempt.score ?? 0} {exam ? `/ ${totalMarks(exam)}` : ''} pts
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {sorted.length > 10 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-3 text-xs font-semibold text-primary hover:underline self-center"
        >
          {showAll ? 'Show Top 10 Only' : `View All ${sorted.length} Participants`}
        </button>
      )}
    </div>
  )
}

function PeopleView({
  data,
  ops,
  rooms,
  user,
  readOnly = false,
  onImpersonate,
}: {
  data: AppData
  ops: AdminOps
  rooms: Room[]
  user: User
  readOnly?: boolean
  onImpersonate?: (user: User) => void
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'student'>('all')
  const [showAddUser, setShowAddUser] = useState(false)
  const [newError, setNewError] = useState('')
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const handleAddUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name')).trim()
    const email = String(form.get('email')).trim()
    const password = String(form.get('password'))
    const role = String(form.get('role')) as 'admin' | 'student'

    setWorking(true)
    setNewError('')
    try {
      const err = await ops.addUser(name, email, password, role)
      if (err) {
        setNewError(err)
      } else {
        setShowAddUser(false)
        setSearchQuery(email)
        ;(event.target as HTMLFormElement).reset()
      }
    } catch {
      setNewError('Failed to create user. Please try again.')
    } finally {
      setWorking(false)
    }
  }

  const handleEditUser = async (event: React.FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name')).trim()
    const email = String(form.get('email')).trim()
    const password = String(form.get('password')).trim()

    setSavingEdit(true)
    setEditError('')
    try {
      const err = await ops.updateUser(id, name, email, password || undefined)
      if (err) {
        setEditError(err)
      } else {
        setEditingUserId(null)
      }
    } catch {
      setEditError('Failed to update user. Please try again.')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDeleteUser = async (targetUser: User) => {
    if (!window.confirm(`Are you sure you want to delete ${targetUser.name}? This will remove them from all rooms and clean up their test attempts.`)) {
      return
    }
    setDeletingId(targetUser.id)
    try {
      await ops.deleteUser(targetUser.id)
    } finally {
      setDeletingId(null)
    }
  }

  const toggleRoom = async (studentId: string, roomId: string, joined: boolean) => {
    setTogglingId(studentId)
    try {
      await ops.toggleRoomMember(studentId, roomId, joined)
    } finally {
      setTogglingId(null)
    }
  }

  // Filter users by role and search
  const filteredUsers = data.users.filter((u) => {
    if (u.role === 'owner') return false
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    return (
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  return (
    <>
      <Heading
        eyebrow="Directory"
        title="People Directory"
        action={
          !readOnly ? (
            <button onClick={() => setShowAddUser(!showAddUser)} className="btn">
              <Plus size={17} /> Add new user
            </button>
          ) : undefined
        }
      />

      {showAddUser && !readOnly && (
        <form
          onSubmit={handleAddUser}
          className="mb-6 grid gap-4 rounded-2xl border bg-card p-5 md:grid-cols-5 animate-in fade-in slide-in-from-top-3 duration-200"
        >
          <Field label="Full name" name="name" placeholder="Alex Morgan" required />
          <Field label="Email" name="email" type="email" placeholder="alex@school.edu" required />
          <Field
            label="Password"
            name="password"
            type="password"
            placeholder="At least 6 chars"
            required
            minLength={4}
          />
          <label className="flex flex-col gap-2 text-sm font-medium">
            Role
            <select name="role" className="rounded-xl border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-ring" required>
              <option value="student">Student</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <div className="flex flex-col gap-2">
            <span className="hidden text-sm font-medium opacity-0 md:block">Action</span>
            <button className="btn" disabled={working}>
              {working ? <Loader2 size={16} className="animate-spin" /> : null}
              Create User
            </button>
          </div>
          {newError && (
            <p role="alert" className="col-span-full text-sm text-destructive">
              {newError}
            </p>
          )}
        </form>
      )}

      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[280px]">
          <input
            type="search"
            placeholder="Search people by name or email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="w-48">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="w-full rounded-xl border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admins</option>
            <option value="student">Students</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 animate-in fade-in duration-300">
        {filteredUsers.map((person) => {
          const isExpanded = expandedUserId === person.id
          const isEditing = editingUserId === person.id
          const isDeleting = deletingId === person.id

          return (
            <article
              key={person.id}
              className="rounded-2xl border bg-card p-6 transition-all hover:shadow-sm"
            >
              {isEditing ? (
                <form
                  onSubmit={(e) => handleEditUser(e, person.id)}
                  className="grid gap-4 md:grid-cols-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Field
                    label="Full name"
                    name="name"
                    defaultValue={person.name}
                    required
                  />
                  <Field
                    label="Email address"
                    name="email"
                    type="email"
                    defaultValue={person.email}
                    required
                  />
                  <Field
                    label="New Password (optional)"
                    name="password"
                    type="password"
                    placeholder="Keep current password"
                  />
                  <div className="col-span-full flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingUserId(null)
                        setEditError('')
                      }}
                      className="btn secondary"
                      disabled={savingEdit}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn" disabled={savingEdit}>
                      {savingEdit ? <Loader2 size={16} className="animate-spin" /> : null}
                      Save Changes
                    </button>
                  </div>
                  {editError && (
                    <p role="alert" className="col-span-full text-sm text-destructive">
                      {editError}
                    </p>
                  )}
                </form>
              ) : (
                <>
                  <div
                    className="flex cursor-pointer items-center justify-between gap-4"
                    onClick={() => {
                      if (person.role === 'student') {
                        setExpandedUserId(isExpanded ? null : person.id)
                      }
                    }}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-semibold">{person.name}</p>
                        <span className={`badge text-xs px-2 py-0.5 ${
                          person.role === 'admin' 
                            ? 'border-blue-500/30 bg-blue-500/10 text-blue-600' 
                            : 'border-purple-500/30 bg-purple-500/10 text-purple-600'
                        }`}>
                          {person.role}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{person.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {person.role === 'student' && (
                        <span className="badge">
                          {person.roomIds?.length || 0} room{person.roomIds?.length === 1 ? '' : 's'} joined
                        </span>
                      )}
                      
                      {user.role === 'owner' && onImpersonate && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onImpersonate(person)
                          }}
                          title={`Impersonate ${person.name}`}
                          className="btn secondary py-1.5 px-3 text-xs flex items-center gap-1 hover:bg-primary hover:text-primary-foreground transition-colors"
                        >
                          <Eye size={13} /> Impersonate
                        </button>
                      )}

                      {!readOnly && (
                        <>
                          <button
                            type="button"
                            aria-label={`Edit ${person.name}`}
                            title="Edit details or password"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingUserId(person.id)
                              setEditError('')
                            }}
                            className="grid size-9 place-items-center rounded-xl border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${person.name}`}
                            title="Delete user"
                            disabled={isDeleting}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteUser(person)
                            }}
                            className="grid size-9 place-items-center rounded-xl border text-muted-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                          >
                            {isDeleting ? (
                              <Loader2 size={15} className="animate-spin" />
                            ) : (
                              <Trash2 size={15} />
                            )}
                          </button>
                        </>
                      )}

                      {person.role === 'student' && (
                        <button
                          type="button"
                          aria-label="Toggle details"
                          className="ml-1 text-muted-foreground hover:text-foreground"
                        >
                          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                      )}
                    </div>
                  </div>
                  {isExpanded && person.role === 'student' && (
                    <div
                      className="mt-5 border-t pt-5 animate-in fade-in slide-in-from-top-2 duration-200"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="mb-3 text-sm font-medium">Manage rooms for {person.name}</p>
                      {togglingId === person.id && (
                        <p className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 size={14} className="animate-spin" /> Updating…
                        </p>
                      )}
                      <div className="flex max-h-40 flex-col gap-2 overflow-y-auto pr-2">
                        {rooms.map((room) => {
                          const isJoined = person.roomIds?.includes(room.id)
                          return (
                            <label
                              key={room.id}
                              className="flex cursor-pointer items-center gap-2 rounded-md p-2 text-sm transition-colors hover:bg-muted"
                            >
                              <input
                                type="checkbox"
                                checked={isJoined}
                                disabled={togglingId === person.id || readOnly}
                                onChange={(e) => toggleRoom(person.id, room.id, e.target.checked)}
                                className="rounded border-primary/50"
                              />
                              {room.name}
                            </label>
                          )
                        })}
                        {!rooms.length && (
                          <p className="text-sm text-muted-foreground">
                            No rooms available. Create a room first.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </article>
          )
        })}
        {!filteredUsers.length && (
          <Empty
            text={
              searchQuery
                ? 'No users found matching your search.'
                : 'No users registered yet.'
            }
          />
        )}
      </div>
    </>
  )
}
