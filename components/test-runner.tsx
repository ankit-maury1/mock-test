'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, EyeOff, Flag, Maximize2, ShieldAlert } from 'lucide-react'
import { gradeAttempt, formatDateTime, optionsOf, type Answer, type AppData, type Attempt, type Exam, type User } from '@/lib/exam-types'
import { cx } from './ui-bits'

const clock = (seconds: number) => {
  const safe = Math.max(0, seconds)
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

export function TestRunner({
  exam,
  user,
  data,
  onSave,
  close,
}: {
  exam: Exam
  user: User
  data: AppData
  /** Called on final submission. Also called during autosave (debounced). */
  onSave: (attempt: Attempt) => Promise<void>
  close: () => void
}) {
  const existing = data.attempts.find(
    (item) => item.examId === exam.id && item.userId === user.id && !item.submittedAt,
  )
  const [attempt, setAttempt] = useState<Attempt>(
    () =>
      existing ?? {
        id: crypto.randomUUID(),
        examId: exam.id,
        userId: user.id,
        startedAt: new Date().toISOString(),
        answers: exam.questions.map((question) => ({
          questionId: question.id,
          status: 'unvisited' as const,
          seconds: 0,
        })),
      },
  )
  const [index, setIndex] = useState(0)
  const [left, setLeft] = useState(() =>
    exam.duration * 60 -
    Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000),
  )
  const submitted = useRef(false)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track time left until hard exam expiration date (endsAt)
  const [expirySecLeft, setExpirySecLeft] = useState<number | null>(() => {
    if (exam.neverUnpublish || !exam.endsAt) return null
    return Math.floor((new Date(exam.endsAt).getTime() - Date.now()) / 1000)
  })

  const question = exam.questions[index]
  const options = useMemo(() => (question ? optionsOf(question) : []), [question])
  const current = attempt.answers.find((item) => item.questionId === question?.id)

  const forceSubmit = useCallback(async () => {
    if (submitted.current) return
    submitted.current = true
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    const graded = gradeAttempt(exam, attempt)
    const done: Attempt = { ...attempt, ...graded, submittedAt: new Date().toISOString() }
    try {
      await onSave(done)
      close()
    } catch (err) {
      console.error('[TestRunner] Submission save failed:', err)
      submitted.current = false
      alert('Failed to submit test. Please check your network connection and try submitting again.')
    }
  }, [attempt, close, exam, onSave])

  const submit = useCallback(() => {
    if (window.confirm('Are you sure you want to submit your final exam?')) {
      forceSubmit()
    }
  }, [forceSubmit])

  // Recompute remaining time from startedAt so a refresh cannot reset the clock.
  useEffect(() => {
    const tick = () =>
      setLeft(
        exam.duration * 60 -
        Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000),
      )
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [attempt.startedAt, exam.duration])

  // Track hard exam expiration countdown
  useEffect(() => {
    if (exam.neverUnpublish || !exam.endsAt) return
    const checkExpiry = () => {
      const remaining = Math.floor((new Date(exam.endsAt!).getTime() - Date.now()) / 1000)
      setExpirySecLeft(remaining)
      if (remaining <= 0) {
        forceSubmit()
      }
    }
    checkExpiry()
    const timer = setInterval(checkExpiry, 1000)
    return () => clearInterval(timer)
  }, [exam.endsAt, exam.neverUnpublish, forceSubmit])

  // Auto-submit when duration time runs out.
  useEffect(() => {
    if (left <= 0) forceSubmit()
  }, [left, forceSubmit])

  // Debounced autosave: save in-progress attempt after 5 s of inactivity.
  useEffect(() => {
    if (submitted.current) return
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => {
      onSave(attempt).catch(() => { })
    }, 5000)
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
  }, [attempt, onSave])

  // Track time spent per question.
  useEffect(() => {
    if (!question) return
    const timer = setInterval(() => {
      setAttempt((state) => ({
        ...state,
        answers: state.answers.map((item) =>
          item.questionId === question.id ? { ...item, seconds: item.seconds + 1 } : item,
        ),
      }))
    }, 1000)
    return () => clearInterval(timer)
  }, [question])

  const update = (patch: Partial<Answer>) => {
    if (!question) return
    setAttempt((state) => ({
      ...state,
      answers: state.answers.map((item) =>
        item.questionId === question.id ? { ...item, ...patch } : item,
      ),
    }))
  }

  // Anti-cheating telemetry states
  const [tabSwitchCount, setTabSwitchCount] = useState<number>(() => existing?.tabSwitchCount ?? 0)
  const [fullscreenExitCount, setFullscreenExitCount] = useState<number>(() => existing?.fullscreenExitCount ?? 0)
  const [cheatWarningCount, setCheatWarningCount] = useState<number>(() => existing?.cheatWarningCount ?? 0)
  const [warningToast, setWarningToast] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)

  const triggerWarning = useCallback((msg: string) => {
    setWarningToast(msg)
    setTimeout(() => {
      setWarningToast((current) => (current === msg ? null : current))
    }, 5000)
  }, [])

  // Immediately persist initial attempt on mount so server & admins know the exam is in progress instantly
  useEffect(() => {
    const initAttempt: Attempt = {
      ...attempt,
      tabSwitchCount: existing?.tabSwitchCount ?? 0,
      fullscreenExitCount: existing?.fullscreenExitCount ?? 0,
      cheatWarningCount: existing?.cheatWarningCount ?? 0,
      lastPingAt: new Date().toISOString(),
      instituteId: exam.instituteId || user.instituteId,
    }
    onSave(initAttempt).catch(() => { })
  }, [])

  // Sync anti-cheating telemetry to attempt object
  useEffect(() => {
    setAttempt((prev) => ({
      ...prev,
      tabSwitchCount,
      fullscreenExitCount,
      cheatWarningCount,
      lastPingAt: new Date().toISOString(),
      instituteId: exam.instituteId || user.instituteId,
    }))
  }, [tabSwitchCount, fullscreenExitCount, cheatWarningCount, exam.instituteId, user.instituteId])

  // Periodic live telemetry ping every 4 seconds while test is active
  useEffect(() => {
    if (submitted.current) return
    const pingTimer = setInterval(() => {
      const liveAttempt: Attempt = {
        ...attempt,
        tabSwitchCount,
        fullscreenExitCount,
        cheatWarningCount,
        lastPingAt: new Date().toISOString(),
        instituteId: exam.instituteId || user.instituteId,
      }
      onSave(liveAttempt).catch(() => { })
    }, 4000)
    return () => clearInterval(pingTimer)
  }, [attempt, cheatWarningCount, exam.instituteId, fullscreenExitCount, onSave, tabSwitchCount, user.instituteId])

  // 1. Tab switch & visibility change listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount((c) => {
          const next = c + 1
          triggerWarning(`⚠️ Anti-Cheating Alert: Window focus loss / tab switch detected (Incident #${next})!`)
          return next
        })
      }
    }
    const handleBlur = () => {
      setTabSwitchCount((c) => {
        const next = c + 1
        triggerWarning(`⚠️ Anti-Cheating Alert: Browser window lost focus (Incident #${next})!`)
        return next
      })
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
    }
  }, [triggerWarning])

  // 2. Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = !!document.fullscreenElement
      setIsFullscreen(active)
      if (!active && !submitted.current) {
        setFullscreenExitCount((c) => {
          const next = c + 1
          triggerWarning(`⚠️ Anti-Cheating Alert: Fullscreen mode exited! Please return to fullscreen.`)
          return next
        })
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [triggerWarning])

  const enterFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { })
    }
  }

  // 3. Security lock: Copy/Paste, Right-click context menu, DevTools shortcuts
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      setCheatWarningCount((c) => c + 1)
      triggerWarning('⚠️ Right-click context menu is disabled during the exam.')
    }
    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault()
      setCheatWarningCount((c) => c + 1)
      triggerWarning('⚠️ Copy / Cut / Paste actions are blocked for exam security.')
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      const isDevTools =
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'i', 'C', 'c', 'J', 'j'].includes(e.key)) ||
        (e.ctrlKey && ['U', 'u'].includes(e.key))

      if (isDevTools) {
        e.preventDefault()
        setCheatWarningCount((c) => c + 1)
        triggerWarning('⚠️ Developer tools and page inspection are blocked.')
      }
    }

    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('copy', handleCopyPaste)
    document.addEventListener('cut', handleCopyPaste)
    document.addEventListener('paste', handleCopyPaste)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('copy', handleCopyPaste)
      document.removeEventListener('cut', handleCopyPaste)
      document.removeEventListener('paste', handleCopyPaste)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [triggerWarning])

  // Auto-submit on window unload / exit tab
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!submitted.current) {
        forceSubmit()
        e.preventDefault()
        e.returnValue = 'Navigating away will automatically submit your test attempt.'
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [forceSubmit])

  if (!question) {
    return (
      <main className="grid min-h-screen place-items-center p-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <p className="text-lg font-medium">This exam has no questions yet.</p>
          <button onClick={close} className="btn">
            Back to tests
          </button>
        </div>
      </main>
    )
  }

  const answeredCount = attempt.answers.filter((item) => item.option !== undefined).length
  const reviewCount = attempt.answers.filter((item) => item.status === 'review').length
  const skippedCount = exam.questions.length - answeredCount

  const institute = data.institutes?.find((i) => i.id === exam.instituteId || i.id === user.instituteId)

  return (
    <main className="min-h-screen bg-muted/40 select-none">
      {/* Floating Anti-Cheating Warning Toast */}
      {warningToast && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl bg-destructive text-destructive-foreground px-5 py-3 text-xs font-bold shadow-2xl animate-bounce">
          <ShieldAlert size={18} />
          <span>{warningToast}</span>
        </div>
      )}

      {/* Fullscreen Prompt Banner */}
      {!isFullscreen && (
        <div className="bg-amber-600 text-white font-semibold px-4 py-2 text-xs flex items-center justify-between gap-2 shadow-md">
          <div className="flex items-center gap-2">
            <EyeOff size={14} />
            <span>Anti-Cheating Protection: Test runner should be viewed in Fullscreen Mode.</span>
          </div>
          <button
            type="button"
            onClick={enterFullscreen}
            className="btn text-[11px] py-1 px-3 bg-white text-amber-950 font-bold hover:bg-amber-50"
          >
            <Maximize2 size={12} className="mr-1 inline" /> Enter Fullscreen
          </button>
        </div>
      )}

      {/* Expiry Warning Banner (<10 minutes remaining until hard exam expiration) */}
      {expirySecLeft !== null && expirySecLeft <= 600 && expirySecLeft > 0 && (
        <div className="bg-amber-500 text-amber-950 font-bold px-4 py-2.5 text-xs text-center border-b flex flex-wrap items-center justify-center gap-2 animate-pulse shadow-md">
          <span>⚠️ URGENT WARNING: This exam expires at {formatDateTime(exam.endsAt)} (Only {Math.max(1, Math.ceil(expirySecLeft / 60))} mins remaining until test expiration)!</span>
          <span>Please review and submit your answers before time runs out.</span>
        </div>
      )}

      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b bg-background px-4 py-4 md:px-8 shadow-xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-foreground">{exam.title}</p>
            {institute && (
              <span className="badge text-[10px] font-bold border-primary/30 bg-primary/10 text-primary">
                {institute.name}
              </span>
            )}
            <span className="badge text-[10px] font-bold border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              🟢 ANTI-CHEAT LIVE
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Question {index + 1} of {exam.questions.length} · {answeredCount} answered
            {!exam.neverUnpublish && exam.endsAt && (
              <span> · Expiry: {formatDateTime(exam.endsAt)}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {/* Anti-cheating header indicators */}
          <div className="hidden sm:flex items-center gap-2 text-[11px] font-medium">
            <span
              className={cx(
                'badge py-0.5 px-2 font-mono',
                tabSwitchCount > 0 ? 'bg-destructive/10 text-destructive border-destructive/30 font-bold' : 'bg-muted text-muted-foreground',
              )}
              title="Tab switches & window focus loss count"
            >
              👁️ Tabs: {tabSwitchCount}
            </span>
            <span
              className={cx(
                'badge py-0.5 px-2 font-mono',
                fullscreenExitCount > 0 ? 'bg-destructive/10 text-destructive border-destructive/30 font-bold' : 'bg-muted text-muted-foreground',
              )}
              title="Fullscreen exit count"
            >
              🖥️ Exits: {fullscreenExitCount}
            </span>
            {cheatWarningCount > 0 && (
              <span className="badge py-0.5 px-2 font-mono bg-destructive/10 text-destructive border-destructive/30 font-bold">
                ⚠️ Blocked: {cheatWarningCount}
              </span>
            )}
          </div>

          <span className={cx('font-mono text-lg font-semibold', (left <= 60 || (expirySecLeft !== null && expirySecLeft <= 600)) && 'text-destructive')}>
            {clock(left)}
          </span>
          <button onClick={submit} className="btn">
            Submit test
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 p-4 lg:grid-cols-[1fr_300px] lg:p-8">
        <section className="rounded-2xl border bg-card p-5 md:p-8 shadow-xs">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{question.section}</span>
            <span>
              +{question.marks} / −{question.negative}
            </span>
          </div>

          {question.prompt && (
            <h1 className="mt-5 text-lg font-medium leading-relaxed text-foreground md:text-2xl">
              {question.prompt}
            </h1>
          )}
          {question.image && (
            <img
              src={question.image}
              alt={`Question ${index + 1}`}
              className="mt-5 w-full rounded-xl border bg-background object-contain max-h-96"
            />
          )}

          {question.kind === 'image' && (
            <p className="mt-5 text-sm text-muted-foreground">
              Read the options from the image, then choose the matching letter.
            </p>
          )}

          <div
            className={cx(
              'mt-6 gap-3',
              question.kind === 'image' ? 'flex flex-wrap' : 'flex flex-col',
            )}
          >
            {options.map((option) => {
              const selected = current?.option === option.index
              return (
                <button
                  key={option.index}
                  onClick={() => update({ option: option.index, status: 'answered' })}
                  aria-pressed={selected}
                  className={cx(
                    'flex items-center gap-4 rounded-xl border p-4 text-left transition',
                    question.kind === 'image' && 'min-w-20 justify-center px-6',
                    selected
                      ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500 dark:bg-emerald-500/20'
                      : 'hover:bg-muted bg-background text-foreground',
                  )}
                >
                  <span
                    className={cx(
                      'grid size-8 shrink-0 place-items-center rounded-lg border font-mono text-sm font-bold',
                      selected
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-border bg-muted text-muted-foreground',
                    )}
                  >
                    {option.letter}
                  </span>
                  {option.text && <span className="font-medium text-foreground">{option.text}</span>}
                </button>
              )
            })}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => update({ option: undefined, status: 'skipped' })}
                className="btn secondary"
              >
                Clear
              </button>
              <button onClick={() => update({ status: 'review' })} className="btn secondary">
                <Flag size={16} /> Review
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIndex(Math.max(0, index - 1))}
                disabled={index === 0}
                className="btn secondary"
              >
                <ChevronLeft size={17} /> Previous
              </button>
              {index === exam.questions.length - 1 ? (
                <button onClick={submit} className="btn bg-emerald-600 text-white hover:bg-emerald-700">
                  Finish & Submit
                </button>
              ) : (
                <button onClick={() => setIndex(index + 1)} className="btn">
                  Save & next <ChevronRight size={17} />
                </button>
              )}
            </div>
          </div>
        </section>

        <aside className="rounded-2xl border bg-card p-5 shadow-xs">
          <p className="font-semibold text-foreground">Question palette</p>
          <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-5">
            {exam.questions.map((item, position) => {
              const answer = attempt.answers.find((entry) => entry.questionId === item.id)
              const state =
                answer?.option !== undefined
                  ? 'answered'
                  : answer?.status === 'review'
                    ? 'review'
                    : 'skipped'

              return (
                <button
                  key={item.id}
                  onClick={() => setIndex(position)}
                  aria-label={`Go to question ${position + 1}`}
                  className={cx(
                    'grid size-10 place-items-center rounded-xl border font-mono text-sm font-bold transition shadow-2xs',
                    position === index && 'ring-2 ring-primary ring-offset-2',
                    state === 'answered' && 'border-emerald-600 bg-emerald-600 text-white dark:bg-emerald-700',
                    state === 'review' && 'border-purple-500 bg-purple-500/20 text-purple-700 dark:text-purple-300',
                    state === 'skipped' && 'border-amber-500/60 bg-amber-500/20 text-amber-800 dark:bg-amber-500/25 dark:text-amber-300',
                  )}
                >
                  {position + 1}
                </button>
              )
            })}
          </div>

          <div className="mt-6 flex flex-col gap-2.5 text-xs text-muted-foreground border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-emerald-600 inline-block" />
                Answered
              </span>
              <span className="font-bold text-foreground">{answeredCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-purple-500 inline-block" />
                Marked for Review
              </span>
              <span className="font-bold text-foreground">{reviewCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-amber-500 inline-block" />
                Skipped / Not Answered
              </span>
              <span className="font-bold text-foreground">{skippedCount}</span>
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}

