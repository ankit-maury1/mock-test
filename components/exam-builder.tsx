'use client'

import { useState } from 'react'
import { ImageIcon, Pencil, Trash2, Type } from 'lucide-react'
import { QuestionEditor } from './question-editor'
import { Empty } from './ui-bits'
import { deleteQuestionImage } from '@/lib/imgbb'
import { letterFor, type Exam, type Question, type Room } from '@/lib/exam-types'

export function QuestionRow({
  question,
  index,
  onEdit,
  onRemove,
}: {
  question: Question
  index: number
  onEdit?: () => void
  onRemove?: () => void
}) {
  return (
    <li className="flex items-start gap-4 border-b py-4 last:border-0">
      <span className="mt-1 font-mono text-sm text-muted-foreground">
        {String(index + 1).padStart(2, '0')}
      </span>
      {question.kind === 'image' && question.image && (
        <img
          src={question.image}
          alt={`Question ${index + 1}`}
          className="size-16 shrink-0 rounded-lg border object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {question.kind === 'image' ? <ImageIcon size={14} /> : <Type size={14} />}
          {question.section} · answer {letterFor(question.answer)} · +{question.marks}/−
          {question.negative}
        </p>
        <p className="mt-1 truncate font-medium">
          {question.prompt || (question.kind === 'image' ? 'Photo question' : 'Untitled question')}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {onEdit && (
          <button
            type="button"
            aria-label={`Edit question ${index + 1}`}
            onClick={onEdit}
            className="grid size-9 shrink-0 place-items-center rounded-lg border text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Pencil size={15} />
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            aria-label={`Remove question ${index + 1}`}
            onClick={() => {
              if (window.confirm('Are you sure you want to remove this question?')) {
                // Permanently delete the image from ImgBB (fire-and-forget)
                if (question.deleteUrl) deleteQuestionImage(question.deleteUrl)
                onRemove()
              }
            }}
            className="grid size-9 shrink-0 place-items-center rounded-lg border text-muted-foreground hover:text-destructive"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </li>
  )
}

/** Creates a brand new exam. At least one question is required before it can be saved. */
export function ExamCreator({
  rooms,
  onCreate,
  onCancel,
}: {
  rooms: Room[]
  onCreate: (exam: Exam) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState(rooms[0]?.subject ?? '')
  const [roomIds, setRoomIds] = useState<string[]>([])
  const [duration, setDuration] = useState(30)
  const [isScheduled, setIsScheduled] = useState(false)
  const [startsAt, setStartsAt] = useState('')
  const [neverUnpublish, setNeverUnpublish] = useState(true)
  const [endsAt, setEndsAt] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [error, setError] = useState('')

  const save = () => {
    if (!title.trim()) return setError('Give the exam a title.')
    if (!roomIds.length) return setError('Select at least one room for this exam.')
    if (!questions.length) return setError('Add at least one question before saving.')
    if (isScheduled && !startsAt) return setError('Select a schedule start date and time.')
    if (!neverUnpublish && !endsAt) return setError('Select an unpublish date, or check Never Unpublish.')

    onCreate({
      id: crypto.randomUUID(),
      roomIds,
      title: title.trim(),
      subject: subject.trim() || 'General',
      duration: Math.max(1, duration),
      published: false,
      startsAt: isScheduled && startsAt ? new Date(startsAt).toISOString() : new Date().toISOString(),
      endsAt: neverUnpublish ? undefined : new Date(endsAt).toISOString(),
      neverUnpublish,
      questions,
    })
  }

  return (
    <section className="flex flex-col gap-5 rounded-2xl border bg-card p-5 md:p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm font-medium">
          Exam title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Optics Practice Test"
            className="rounded-xl border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Subject
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Physics"
            className="rounded-xl border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <div className="flex flex-col gap-2 text-sm font-medium">
          Rooms
          <div className="flex max-h-40 flex-col gap-2 overflow-y-auto rounded-xl border bg-background p-3">
            {rooms.map((room) => (
              <label key={room.id} className="flex cursor-pointer items-center gap-2 font-normal">
                <input
                  type="checkbox"
                  checked={roomIds.includes(room.id)}
                  onChange={(e) => {
                    if (e.target.checked) setRoomIds([...roomIds, room.id])
                    else setRoomIds(roomIds.filter((id) => id !== room.id))
                  }}
                  className="rounded"
                />
                {room.name}
              </label>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Duration (minutes)
          <input
            type="number"
            min={1}
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value) || 1)}
            className="rounded-xl border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <div className="flex flex-col gap-2 text-sm font-medium">
          Schedule & Availability
          <div className="flex flex-col gap-3 rounded-xl border bg-background p-3">
            <label className="flex cursor-pointer items-center gap-2 font-normal text-muted-foreground">
              <input
                type="checkbox"
                checked={isScheduled}
                onChange={(e) => setIsScheduled(e.target.checked)}
                className="rounded"
              />
              Schedule for future start time
            </label>
            {isScheduled && (
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Start Date & Time:
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            )}
            <hr className="my-1 border-border" />
            <label className="flex cursor-pointer items-center gap-2 font-normal text-muted-foreground">
              <input
                type="checkbox"
                checked={neverUnpublish}
                onChange={(e) => setNeverUnpublish(e.target.checked)}
                className="rounded"
              />
              Never unpublish / expire
            </label>
            {!neverUnpublish && (
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Expiry Date & Time:
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-background p-5">
        <p className="font-semibold">Questions added ({questions.length})</p>
        {questions.length ? (
          <ul className="mt-3 flex flex-col">
            {questions.map((question, index) => (
              <QuestionRow
                key={question.id}
                question={question}
                index={index}
                onEdit={() => setEditingIndex(index)}
                onRemove={() => setQuestions(questions.filter((item) => item.id !== question.id))}
              />
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Add your first question below. Photo questions only need the image and the correct option.
          </p>
        )}
      </div>

      {editingIndex !== null ? (
        <div className="rounded-2xl border border-primary/40 bg-muted/30 p-4">
          <p className="mb-3 text-sm font-medium text-primary">Editing Question #{editingIndex + 1}</p>
          <QuestionEditor
            initial={questions[editingIndex]}
            saveLabel="Update question"
            onSave={(updated) => {
              setQuestions((current) =>
                current.map((q, idx) => (idx === editingIndex ? updated : q)),
              )
              setEditingIndex(null)
            }}
            onCancel={() => setEditingIndex(null)}
          />
        </div>
      ) : (
        <QuestionEditor
          onSave={(question) => {
            setQuestions((current) => [...current, question])
            setError('')
          }}
          onApplyToAll={(marks, negative) => {
            setQuestions((current) => current.map((q) => ({ ...q, marks, negative })))
          }}
        />
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={save} className="btn">
          Save exam (Draft)
        </button>
        <button type="button" onClick={onCancel} className="btn secondary">
          Cancel
        </button>
      </div>
    </section>
  )
}

/** Appends or removes questions on an exam that already exists. */
export function ExamQuestionManager({
  exam,
  onChange,
  readOnly = false,
}: {
  exam: Exam
  onChange: (questions: Question[]) => void
  readOnly?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  return (
    <div className="mt-5 border-t pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {exam.questions.length} question{exam.questions.length === 1 ? '' : 's'} ·{' '}
          {exam.questions.filter((question) => question.kind === 'image').length} from photos
        </p>
        <button type="button" onClick={() => setOpen(!open)} className="btn secondary">
          {open ? 'Close' : readOnly ? 'View questions' : 'Manage questions'}
        </button>
      </div>
      {open && (
        <div className="mt-4 flex flex-col gap-4">
          {exam.questions.length ? (
            <ul className="flex flex-col rounded-2xl border bg-background px-5">
              {exam.questions.map((question, index) => (
                <QuestionRow
                  key={question.id}
                  question={question}
                  index={index}
                  onEdit={readOnly ? undefined : () => setEditingIndex(index)}
                  onRemove={
                    readOnly
                      ? undefined
                      : () => onChange(exam.questions.filter((item) => item.id !== question.id))
                  }
                />
              ))}
            </ul>
          ) : (
            <Empty text="This exam has no questions yet." />
          )}

          {!readOnly && (
            <>
              {editingIndex !== null ? (
                <div className="rounded-2xl border border-primary/40 bg-muted/30 p-4">
                  <p className="mb-3 text-sm font-medium text-primary">Editing Question #{editingIndex + 1}</p>
                  <QuestionEditor
                    initial={exam.questions[editingIndex]}
                    saveLabel="Update question"
                    onSave={(updated) => {
                      onChange(
                        exam.questions.map((q, idx) => (idx === editingIndex ? updated : q)),
                      )
                      setEditingIndex(null)
                    }}
                    onCancel={() => setEditingIndex(null)}
                  />
                </div>
              ) : (
                <QuestionEditor
                  onSave={(question) => onChange([...exam.questions, question])}
                  onApplyToAll={(marks, negative) =>
                    onChange(exam.questions.map((q) => ({ ...q, marks, negative })))
                  }
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
