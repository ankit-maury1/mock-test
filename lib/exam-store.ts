import type { AppData, Question, Session } from './exam-types'

const now = new Date()
const start = new Date(now.getTime() - 30 * 60 * 1000).toISOString()
const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

const textQuestion = (
  id: string,
  section: string,
  prompt: string,
  options: string[],
  answer: number,
): Question => ({ id, section, kind: 'text', prompt, options, answer, marks: 4, negative: 1 })

export const seedData: AppData = {
  users: [
    {
      id: 'usr_owner',
      name: 'Owner',
      email: 'owner@gmail.com',
      password: 'owner123',
      role: 'owner',
      roomIds: [],
    },
    { id: 'admin-1', name: 'Dr. Vikram Sharma', email: 'admin@prayas.test', password: 'admin123', role: 'admin', roomIds: ['room-1', 'room-2'], instituteId: 'inst-1' },
    { id: 'student-1', name: 'Alex Morgan', email: 'student@axis.test', password: 'student123', role: 'student', roomIds: ['room-1'], instituteId: 'inst-1' },
    { id: 'student-2', name: 'Nina Park', email: 'nina@axis.test', password: 'student123', role: 'student', roomIds: ['room-1'], instituteId: 'inst-1' },
  ],
  rooms: [
    { id: 'room-1', name: 'Physics Cohort A', subject: 'Physics', code: 'PHYS24', adminId: 'admin-1', memberIds: ['student-1', 'student-2'], instituteId: 'inst-1' },
    { id: 'room-2', name: 'Mathematics Elite', subject: 'Mathematics', code: 'MATH24', adminId: 'admin-1', memberIds: [], instituteId: 'inst-1' },
  ],
  exams: [
    {
      id: 'exam-1',
      roomIds: ['room-1'],
      title: 'Motion & Mechanics Mock',
      subject: 'Physics',
      duration: 30,
      published: true,
      startsAt: start,
      endsAt: end,
      questions: [
        textQuestion('q1', 'Mechanics', 'A body starts from rest and accelerates uniformly at 4 m/s². What is its velocity after 5 seconds?', ['10 m/s', '15 m/s', '20 m/s', '25 m/s'], 2),
        textQuestion('q2', 'Mechanics', 'Which quantity remains conserved in every isolated collision?', ['Kinetic energy', 'Linear momentum', 'Velocity', 'Acceleration'], 1),
        textQuestion('q3', 'Waves', 'The distance between two consecutive crests is called:', ['Amplitude', 'Frequency', 'Wavelength', 'Period'], 2),
        textQuestion('q4', 'Waves', 'If wave speed is 340 m/s and frequency is 170 Hz, find the wavelength.', ['0.5 m', '1 m', '2 m', '4 m'], 2),
        textQuestion('q5', 'Energy', 'The SI unit of power is:', ['Joule', 'Newton', 'Watt', 'Pascal'], 2),
      ],
      instituteId: 'inst-1',
    },
  ],
  attempts: [
    {
      id: 'attempt-seed',
      examId: 'exam-1',
      userId: 'student-2',
      startedAt: start,
      submittedAt: now.toISOString(),
      answers: [
        { questionId: 'q1', option: 2, status: 'answered', seconds: 34 },
        { questionId: 'q2', option: 1, status: 'answered', seconds: 42 },
        { questionId: 'q3', option: 0, status: 'answered', seconds: 58 },
        { questionId: 'q4', option: 2, status: 'answered', seconds: 39 },
        { questionId: 'q5', option: 2, status: 'answered', seconds: 25 },
      ],
      score: 15,
      correct: 4,
      incorrect: 1,
      instituteId: 'inst-1',
    },
  ],
  institutes: [
    {
      id: 'inst-1',
      name: 'Prayas Coaching Institute',
      description: 'Main campus coaching institute',
    },
  ],
}

const DATA_KEY = 'axis-exam-data-v2'
const SESSION_KEY = 'axis-exam-session-v1'

function normalize(data: AppData): AppData {
  return {
    ...data,
    institutes: data.institutes ?? [],
    exams: (data.exams ?? []).map((exam: any) => ({
      ...exam,
      roomIds: exam.roomIds ?? (exam.roomId ? [exam.roomId] : []),
      questions: (exam.questions ?? []).map((question: any) => ({
        ...question,
        kind: question.kind ?? (question.image ? 'image' : 'text'),
        options: question.options?.length ? question.options : ['', '', '', ''],
        section: question.section || 'General',
        answer: Number(question.answer ?? 0),
        marks: Number(question.marks ?? 4),
        negative: Number(question.negative ?? 1),
      })),
    })),
    attempts: (data.attempts ?? []).map((attempt: any) => ({
      ...attempt,
      answers: (attempt.answers ?? []).map((ans: any) => ({
        ...ans,
        option: ans.option !== undefined && ans.option !== null ? Number(ans.option) : undefined,
      })),
    })),
  }
}

export function loadData(): AppData {
  if (typeof window === 'undefined') return seedData
  try {
    const raw = localStorage.getItem(DATA_KEY)
    return raw ? normalize(JSON.parse(raw) as AppData) : structuredClone(seedData)
  } catch {
    return structuredClone(seedData)
  }
}

export function saveData(data: AppData) {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data))
  } catch {
    // Image-heavy exams can exceed the localStorage quota; the in-memory session still works.
    console.log('[v0] Unable to persist data — storage quota reached.')
  }
}

export function loadSession(): Session {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function saveSession(session: Session) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  else localStorage.removeItem(SESSION_KEY)
}

// Production MongoDB adapter lives in lib/mongodb.ts + lib/models.ts + app/api/*
// The functions above (loadData, saveData, loadSession, saveSession) are used as a
// localStorage fallback when MONGODB_URI is not configured.



//
// let connection: Promise<typeof mongoose> | null = null
// export function connectMongo() {
//   if (!process.env.MONGODB_URI) throw new Error('Add MONGODB_URI to your environment.')
//   connection ??= mongoose.connect(process.env.MONGODB_URI)
//   return connection
// }
//
// const QuestionSchema = new Schema(
//   {
//     section: String,
//     kind: { type: String, enum: ['text', 'image'], default: 'image' },
//     prompt: String,
//     image: String,
//     options: [String],
//     answer: Number,
//     marks: Number,
//     negative: Number,
//   },
//   { _id: false },
// )
//
// const ExamSchema = new Schema({
//   roomIds: [String],
//   title: String,
//   subject: String,
//   duration: Number,
//   published: Boolean,
//   startsAt: Date,
//   endsAt: Date,
//   neverUnpublish: Boolean,
//   questions: [QuestionSchema],
// })
//
// export const ExamModel = models.Exam ?? model('Exam', ExamSchema)
