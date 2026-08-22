'use client'

import { useRef, useState } from 'react'
import { Check, ImagePlus, Loader2, Minus, Plus, Trash2 } from 'lucide-react'
import { deleteQuestionImage, uploadQuestionImage } from '@/lib/imgbb'
import { blankQuestion, letterFor, validateQuestion, type Question, type QuestionKind } from '@/lib/exam-types'
import { cx } from './ui-bits'

interface Props {
  /** Question being edited. Pass an existing question to edit, or omit to start a blank image question. */
  initial?: Question
  onSave: (question: Question) => void
  onCancel?: () => void
  onApplyToAll?: (marks: number, negative: number) => void
  saveLabel?: string
}

export function QuestionEditor({ initial, onSave, onCancel, onApplyToAll, saveLabel = 'Add question' }: Props) {
  const [draft, setDraft] = useState<Question>(() => initial ?? blankQuestion('image'))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // Upload runs in the background — other fields remain fully interactive
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading'>('idle')
  const [keepSame, setKeepSame] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const patch = (changes: Partial<Question>) => {
    setDraft((current) => ({ ...current, ...changes }))
    setError('')
  }

  const setKind = (kind: QuestionKind) => patch({ kind })

  const setOptionCount = (count: number) => {
    if (count < 2 || count > 6) return
    const options = Array.from({ length: count }, (_, index) => draft.options[index] ?? '')
    patch({ options, answer: Math.min(Number(draft.answer), count - 1) })
  }

  /**
   * Picks and uploads an image in the background.
   * The rest of the form stays fully interactive during upload.
   * If there was a previous ImgBB image, it is permanently deleted before replacing.
   */
  const pickImage = async (file?: File) => {
    if (!file) return
    setUploadStatus('uploading')
    setError('')
    setNotice('')

    try {
      const result = await uploadQuestionImage(file)

      // Delete the old image   before replacing (fire-and-forget)
      if (draft.deleteUrl) deleteQuestionImage(draft.deleteUrl)

      patch({ image: result.url, deleteUrl: result.deleteUrl })
      setNotice(
        result.hosted
          ? '✓ image is permanently hosted.'
          : 'Saved locally. Add API_KEY to host images on ImgBB permanently.',
      )
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed.')
    } finally {
      setUploadStatus('idle')
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  /** Removes the image and deletes it   (fire-and-forget). */
  const removeImage = () => {
    if (draft.deleteUrl) deleteQuestionImage(draft.deleteUrl)
    patch({ image: undefined, deleteUrl: undefined })
    setNotice('')
  }

  const save = () => {
    if (uploadStatus === 'uploading') {
      setError('Please wait for the image upload to finish before saving.')
      return
    }
    const problem = validateQuestion(draft)
    if (problem) return setError(problem)

    const finalMarks = Math.max(1, Number(draft.marks) || 1)
    const finalNegative = Math.max(0, Number(draft.negative) || 0)

    onSave({
      ...draft,
      prompt: draft.prompt.trim(),
      answer: Number(draft.answer),
      marks: finalMarks,
      negative: finalNegative,
    })

    // Prepare the next blank question
    const nextBlank = blankQuestion(draft.kind)
    if (keepSame) {
      nextBlank.marks = finalMarks
      nextBlank.negative = finalNegative
    }
    setDraft(nextBlank)
    setNotice('')
    setError('')
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border bg-card p-5">
      {/* ── Header: title + kind toggle ────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{initial ? 'Edit question' : 'New question'}</p>
          <p className="text-sm text-muted-foreground">
            Upload one photo containing the question and its options, or type it out.
          </p>
        </div>
        <div className="flex rounded-xl border p-1" role="group" aria-label="Question input mode">
          {(['image', 'text'] as QuestionKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={draft.kind === kind}
              onClick={() => setKind(kind)}
              className={cx(
                'rounded-lg px-3 py-2 text-sm font-medium capitalize transition',
                draft.kind === kind
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {kind === 'image' ? 'Photo' : 'Text'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Question input area ─────────────────────────────────────────── */}
      {draft.kind === 'image' ? (
        <div className="flex flex-col gap-4">
          {/* Upload zone — shows spinner while uploading, rest of form stays interactive */}
          <label
            className={cx(
              'flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground transition',
              uploadStatus === 'uploading' ? 'opacity-75 cursor-not-allowed' : 'hover:bg-muted',
            )}
          >
            {uploadStatus === 'uploading' ? (
              <>
                <Loader2 className="animate-spin text-primary" />
                <span className="font-medium text-foreground">Uploading...</span>
                <span className="text-xs">You can fill in other fields while this uploads</span>
              </>
            ) : (
              <>
                <ImagePlus />
                <span className="font-medium text-foreground">
                  {draft.image ? 'Replace question photo' : 'Upload question photo'}
                </span>
                <span>Question and options in a single image · PNG or JPG up to 6 MB</span>
              </>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={uploadStatus === 'uploading'}
              onChange={(event) => pickImage(event.target.files?.[0])}
            />
          </label>

          {draft.image && uploadStatus === 'idle' && (
            <div className="flex flex-col gap-3">
              <img
                src={draft.image}
                alt="Uploaded question"
                className="max-h-80 w-full rounded-xl border object-contain"
              />
              <button
                type="button"
                onClick={removeImage}
                className="flex items-center gap-2 self-start text-sm text-muted-foreground hover:text-destructive"
              >
                <Trash2 size={15} /> Remove image
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">Options in the image</span>
            <div className="flex items-center gap-2 rounded-xl border p-1">
              <button
                type="button"
                aria-label="Fewer options"
                onClick={() => setOptionCount(draft.options.length - 1)}
                className="grid size-8 place-items-center rounded-lg hover:bg-muted"
              >
                <Minus size={15} />
              </button>
              <span className="w-6 text-center font-mono text-sm">{draft.options.length}</span>
              <button
                type="button"
                aria-label="More options"
                onClick={() => setOptionCount(draft.options.length + 1)}
                className="grid size-8 place-items-center rounded-lg hover:bg-muted"
              >
                <Plus size={15} />
              </button>
            </div>
            <span className="text-sm text-muted-foreground">
              Students will see {draft.options.map((_, index) => letterFor(index)).join(' · ')}
            </span>
          </div>

          <label className="flex flex-col gap-2 text-sm font-medium">
            Caption (optional)
            <input
              value={draft.prompt}
              onChange={(event) => patch({ prompt: event.target.value })}
              placeholder="Shown above the image, e.g. Refer to the figure"
              className="rounded-xl border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Question text
            <textarea
              value={draft.prompt}
              onChange={(event) => patch({ prompt: event.target.value })}
              rows={3}
              placeholder="Type the full question"
              className="rounded-xl border bg-background px-4 py-3 font-normal leading-relaxed outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <div className="flex flex-col gap-3">
            {draft.options.map((option, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border font-mono text-sm">
                  {letterFor(index)}
                </span>
                <input
                  value={option}
                  onChange={(event) =>
                    patch({
                      options: draft.options.map((item, position) =>
                        position === index ? event.target.value : item,
                      ),
                    })
                  }
                  placeholder={`Option ${letterFor(index)}`}
                  className="min-w-0 flex-1 rounded-xl border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-ring"
                />
                {draft.options.length > 2 && (
                  <button
                    type="button"
                    aria-label={`Remove option ${letterFor(index)}`}
                    onClick={() => {
                      const options = draft.options.filter((_, position) => position !== index)
                      patch({ options, answer: Math.min(draft.answer, options.length - 1) })
                    }}
                    className="grid size-9 shrink-0 place-items-center rounded-lg border text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
            {draft.options.length < 6 && (
              <button
                type="button"
                onClick={() => setOptionCount(draft.options.length + 1)}
                className="flex items-center gap-2 self-start text-sm text-muted-foreground hover:text-foreground"
              >
                <Plus size={15} /> Add option
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Correct answer picker ────────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">Correct answer (required)</legend>
        <div className="flex flex-wrap gap-2">
          {draft.options.map((option, index) => (
            <button
              key={index}
              type="button"
              aria-pressed={draft.answer === index}
              onClick={() => patch({ answer: index })}
              className={cx(
                'flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition',
                draft.answer === index
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'hover:bg-muted',
              )}
            >
              {draft.answer === index && <Check size={15} />}
              {letterFor(index)}
              {draft.kind === 'text' && option.trim() && (
                <span className="max-w-32 truncate font-normal opacity-80">{option}</span>
              )}
            </button>
          ))}
        </div>
      </fieldset>

      {/* ── Scoring ──────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-2 text-sm font-medium">
          Section
          <input
            value={draft.section}
            onChange={(event) => patch({ section: event.target.value })}
            className="rounded-xl border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Marks
            <input
              type="number"
              min={1}
              value={draft.marks}
              onChange={(event) => patch({ marks: Math.max(1, Number(event.target.value) || 1) })}
              className="rounded-xl border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="mt-1 flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={keepSame}
              onChange={(e) => setKeepSame(e.target.checked)}
              className="rounded"
            />
            Keep same as previous
          </label>
        </div>
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Negative
            <input
              type="number"
              min={0}
              value={draft.negative}
              onChange={(event) =>
                patch({ negative: Math.max(0, Number(event.target.value) || 0) })
              }
              className="rounded-xl border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          {onApplyToAll && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Apply these marks to all existing questions in this exam?')) {
                  onApplyToAll(draft.marks, draft.negative)
                }
              }}
              className="mt-1 self-start text-sm font-medium text-primary hover:underline"
            >
              Apply to all questions
            </button>
          )}
        </div>
      </div>

      {/* ── Status messages ───────────────────────────────────────────────── */}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!error && notice && <p className="text-sm text-muted-foreground">{notice}</p>}

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={save}
          disabled={uploadStatus === 'uploading'}
          className="btn"
          title={uploadStatus === 'uploading' ? 'Waiting for image upload…' : undefined}
        >
          {uploadStatus === 'uploading' ? (
            <>
              <Loader2 size={17} className="animate-spin" /> Uploading…
            </>
          ) : (
            <>
              <Plus size={17} /> {saveLabel}
            </>
          )}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn secondary">
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
