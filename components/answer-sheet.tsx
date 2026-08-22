'use client'

import { Check, Clock, X, XCircle } from 'lucide-react'
import { gradeAttempt, letterFor, optionsOf, type Attempt, type Exam } from '@/lib/exam-types'
import { cx } from './ui-bits'

interface Props {
  exam: Exam
  attempt: Attempt
  studentName?: string
  instituteName?: string
  onClose: () => void
}

const formatSeconds = (sec?: number) => {
  const safe = Math.max(0, sec ?? 0)
  const m = Math.floor(safe / 60)
  const s = safe % 60
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function AnswerSheetViewer({ exam, attempt, studentName, instituteName, onClose }: Props) {
  const grade = gradeAttempt(exam, attempt)

  return (
    <div className="flex flex-col gap-6 rounded-2xl border bg-card p-6 shadow-xl">
      {/* ── Header Summary ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge">Submitted Answer Sheet</span>
            {instituteName && (
              <span className="badge border-primary/30 bg-primary/10 text-primary font-bold text-xs">
                {instituteName}
              </span>
            )}
          </div>
          <h2 className="mt-2 text-2xl font-bold">{exam.title}</h2>
          {studentName && (
            <p className="text-sm font-medium text-primary">Student: {studentName}</p>
          )}

          {/* Anti-Cheating Summary Badges */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`badge py-0.5 px-2.5 font-mono font-semibold ${
                (attempt.tabSwitchCount ?? 0) > 0
                  ? 'border-destructive/40 bg-destructive/10 text-destructive font-bold'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              👁️ Tab Switches: {attempt.tabSwitchCount ?? 0}
            </span>
            <span
              className={`badge py-0.5 px-2.5 font-mono font-semibold ${
                (attempt.fullscreenExitCount ?? 0) > 0
                  ? 'border-destructive/40 bg-destructive/10 text-destructive font-bold'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              🖥️ Fullscreen Exits: {attempt.fullscreenExitCount ?? 0}
            </span>
            {(attempt.cheatWarningCount ?? 0) > 0 && (
              <span className="badge py-0.5 px-2.5 font-mono border-destructive/40 bg-destructive/10 text-destructive font-bold">
                ⚠️ Blocked Actions: {attempt.cheatWarningCount}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-3xl font-extrabold text-foreground">
              {grade.score}{' '}
              <span className="text-sm font-normal text-muted-foreground">
                / {exam.questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0)} marks
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {grade.correct} Correct · {grade.incorrect} Incorrect · {grade.accuracy}% Accuracy
            </p>
          </div>
          <button onClick={onClose} className="btn secondary py-2">
            Close Solutions
          </button>
        </div>
      </div>

      {/* ── Question-by-Question Solutions ────────────────────────────── */}
      <div className="flex flex-col gap-6">
        {exam.questions.map((question, qIdx) => {
          const answer = attempt.answers.find((a) => a.questionId === question.id)
          const studentOpt =
            answer?.option !== undefined && answer?.option !== null
              ? Number(answer.option)
              : undefined
          const correctOpt = Number(question.answer)

          const isAnswered = studentOpt !== undefined && !isNaN(studentOpt)
          const isCorrect = isAnswered && studentOpt === correctOpt
          const isIncorrect = isAnswered && studentOpt !== correctOpt

          const options = optionsOf(question)

          return (
            <article
              key={question.id}
              className={cx(
                'rounded-xl border p-5 transition-colors',
                isCorrect && 'border-emerald-500/40 bg-emerald-500/5',
                isIncorrect && 'border-destructive/40 bg-destructive/5',
                !isAnswered && 'bg-muted/20',
              )}
            >
              {/* Question Header & Badges */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-foreground">
                    Q{qIdx + 1}.
                  </span>
                  <span className="text-muted-foreground">{question.section}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock size={13} /> {formatSeconds(answer?.seconds)}
                  </span>
                  {isCorrect ? (
                    <span className="badge flex items-center gap-1 border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Check size={13} /> Correct (+{question.marks} marks)
                    </span>
                  ) : isIncorrect ? (
                    <span className="badge flex items-center gap-1 border-destructive/50 bg-destructive/10 text-destructive">
                      <X size={13} /> Incorrect (-{question.negative} marks)
                    </span>
                  ) : (
                    <span className="badge flex items-center gap-1 border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <XCircle size={13} /> Skipped (0 marks)
                    </span>
                  )}
                </div>
              </div>

              {/* Question Prompt */}
              {question.prompt && (
                <p className="mt-3 text-base font-semibold leading-relaxed">
                  {question.prompt}
                </p>
              )}

              {/* Question Image */}
              {question.image && (
                <img
                  src={question.image}
                  alt={`Question ${qIdx + 1}`}
                  className="mt-3 max-h-80 rounded-xl border bg-background object-contain"
                />
              )}

              {/* Options Breakdown */}
              <div className="mt-4 flex flex-col gap-2">
                {options.map((opt) => {
                  const isThisCorrect = opt.index === correctOpt
                  const isThisSelected = opt.index === studentOpt

                  return (
                    <div
                      key={opt.index}
                      className={cx(
                        'flex items-center justify-between rounded-xl border p-3.5 text-sm transition',
                        isThisCorrect &&
                          'border-emerald-500 bg-emerald-500/10 text-emerald-950 font-medium dark:text-emerald-200',
                        isThisSelected &&
                          !isThisCorrect &&
                          'border-destructive bg-destructive/10 text-destructive font-medium',
                        !isThisCorrect && !isThisSelected && 'bg-background text-foreground opacity-80',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={cx(
                            'grid size-7 place-items-center rounded-lg border font-mono text-xs font-bold',
                            isThisCorrect &&
                              'border-emerald-500 bg-emerald-500 text-white dark:text-black',
                            isThisSelected &&
                              !isThisCorrect &&
                              'border-destructive bg-destructive text-white',
                          )}
                        >
                          {opt.letter}
                        </span>
                        <span>{opt.text || `Option ${opt.letter}`}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        {isThisCorrect && (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <Check size={14} /> Correct Answer
                          </span>
                        )}
                        {isThisSelected && !isThisCorrect && (
                          <span className="flex items-center gap-1 text-destructive">
                            <X size={14} /> Student Selected
                          </span>
                        )}
                        {isThisSelected && isThisCorrect && (
                          <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                            Selected
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
