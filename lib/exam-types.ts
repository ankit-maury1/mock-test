export type Role = 'owner' | 'admin' | 'student'
export type QuestionStatus = 'unvisited' | 'answered' | 'review' | 'skipped'
/** 'text' questions are typed out. 'image' questions are a single photo that already contains the question and its options. */
export type QuestionKind = 'text' | 'image'

export interface Institute {
  id: string
  name: string
  description?: string
  status?: 'active' | 'inactive' | 'pending' | 'rejected'
  rejectionReason?: string
}

export interface User {
  id: string
  name: string
  email: string
  password: string
  role: Role
  roomIds: string[]
  instituteId?: string
  status?: 'active' | 'inactive'
}

export interface Room {
  id: string
  name: string
  subject: string
  code: string
  adminId: string
  memberIds: string[]
  instituteId?: string
}

export interface Question {
  id: string
  section: string
  kind: QuestionKind
  /** Required for text questions, optional caption for image questions. */
  prompt: string
  /** Uploaded question image (ImgBB display_url in production, data URL in the local mock). */
  image?: string
  /** ImgBB delete_url — stored so the image can be permanently removed   when this question is deleted or its image replaced. */
  deleteUrl?: string
  /** Option labels. Entries may be empty strings when the options live inside the image. */
  options: string[]
  answer: number
  marks: number
  negative: number
}

export interface Exam {
  id: string
  roomIds: string[]
  title: string
  subject: string
  duration: number
  published: boolean
  startsAt: string
  endsAt?: string
  neverUnpublish?: boolean
  questions: Question[]
  instituteId?: string
}

export interface Answer {
  questionId: string
  option?: number
  status: QuestionStatus
  seconds: number
}

export interface Attempt {
  id: string
  examId: string
  userId: string
  startedAt: string
  submittedAt?: string
  answers: Answer[]
  score?: number
  correct?: number
  incorrect?: number
  instituteId?: string
  tabSwitchCount?: number
  fullscreenExitCount?: number
  cheatWarningCount?: number
  lastPingAt?: string
}

export interface AppData {
  users: User[]
  rooms: Room[]
  exams: Exam[]
  attempts: Attempt[]
  institutes: Institute[]
}

export type Session = { userId: string } | null

export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
export const letterFor = (index: number) => OPTION_LETTERS[index] ?? String(index + 1)

/** Never trust stored option arrays blindly — image questions can have blank labels. */
export function optionsOf(question: Question) {
  const count = Math.max(2, question.options.length || 4)
  return Array.from({ length: count }, (_, index) => ({
    index,
    letter: letterFor(index),
    text: question.options[index]?.trim() ?? '',
  }))
}

export const totalMarks = (exam: Exam) =>
  exam.questions.reduce((sum, question) => sum + (Number(question.marks) || 0), 0)

export function gradeAttempt(exam: Exam, attempt: Attempt) {
  let score = 0
  let correct = 0
  let incorrect = 0
  for (const question of exam.questions) {
    const answer = attempt.answers.find((item) => item.questionId === question.id)
    if (!answer || answer.option === undefined || answer.option === null) continue

    const studentOption = Number(answer.option)
    const correctOption = Number(question.answer)
    const qMarks = Number(question.marks) || 0
    const qNegative = Number(question.negative) || 0

    if (!isNaN(studentOption) && !isNaN(correctOption) && studentOption === correctOption) {
      score += qMarks
      correct++
    } else {
      score -= qNegative
      incorrect++
    }
  }
  const attempted = correct + incorrect
  return { score, correct, incorrect, attempted, accuracy: attempted ? Math.round((correct / attempted) * 100) : 0 }
}

export function blankQuestion(kind: QuestionKind = 'image'): Question {
  return {
    id: crypto.randomUUID(),
    section: 'General',
    kind,
    prompt: '',
    options: ['', '', '', ''],
    answer: 0,
    marks: 4,
    negative: 1,
  }
}

/** Shared validation so the builder and any future API route enforce identical rules. */
export function validateQuestion(question: Question): string | null {
  if (question.kind === 'image') {
    if (!question.image) return 'Upload the question image, or switch this question to text mode.'
  } else if (!question.prompt.trim()) {
    return 'Enter the question text.'
  } else if (question.options.some((option) => !option.trim())) {
    return 'Fill in every option, or remove the empty ones.'
  }
  if (question.options.length < 2) return 'A question needs at least two options.'
  const ansNum = Number(question.answer)
  if (isNaN(ansNum) || ansNum < 0 || ansNum >= question.options.length) return 'Select the correct option.'
  return null
}

/** Formats date inputs as dd/mm/yyyy hh:mm AM/PM */
export function formatDateTime(dateInput?: string | Date | null): string {
  if (!dateInput) return '—'
  const d = new Date(dateInput)
  if (isNaN(d.getTime())) return '—'
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  let hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  hours = hours ? hours : 12
  const strHours = String(hours).padStart(2, '0')
  return `${day}/${month}/${year} ${strHours}:${minutes} ${ampm}`
}
