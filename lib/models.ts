import { Schema, model, models } from 'mongoose'

// ─── Sub-schemas (no _id, embedded in parents) ──────────────────────────────

const AnswerSchema = new Schema(
  {
    questionId: { type: String, required: true },
    option: Number,
    status: {
      type: String,
      enum: ['unvisited', 'answered', 'review', 'skipped'],
      default: 'unvisited',
    },
    seconds: { type: Number, default: 0 },
  },
  { _id: false },
)

const QuestionSchema = new Schema(
  {
    id: { type: String, required: true },
    section: { type: String, default: 'General' },
    kind: { type: String, enum: ['text', 'image'], default: 'image' },
    prompt: { type: String, default: '' },
    /** ImgBB display URL (permanent CDN link). */
    image: String,
    /** ImgBB delete URL — stored so the image can be permanently removed when the question is deleted. */
    deleteUrl: String,
    options: [String],
    answer: { type: Number, required: true },
    marks: { type: Number, default: 4 },
    negative: { type: Number, default: 1 },
  },
  { _id: false },
)

// ─── Institute ───────────────────────────────────────────────────────────────

const InstituteSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: true },
)

// ─── User ────────────────────────────────────────────────────────────────────

const UserSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address'],
    },
    /** bcrypt hash of the password — never stored as plain text. */
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['owner', 'admin', 'student'], default: 'student' },
    roomIds: { type: [String], default: [] },
    instituteId: { type: String },
  },
  { timestamps: true },
)

// ─── Room ────────────────────────────────────────────────────────────────────

const RoomSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    subject: { type: String, required: true, trim: true, maxlength: 80 },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    adminId: { type: String, required: true },
    memberIds: { type: [String], default: [] },
    instituteId: { type: String },
  },
  { timestamps: true },
)

// ─── Exam ────────────────────────────────────────────────────────────────────

const ExamSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    roomIds: { type: [String], default: [] },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    subject: { type: String, default: 'General', trim: true },
    duration: { type: Number, required: true, min: 1 },
    published: { type: Boolean, default: false },
    startsAt: { type: String, required: true },
    endsAt: String,
    neverUnpublish: Boolean,
    questions: { type: [QuestionSchema], default: [] },
    instituteId: { type: String },
  },
  { timestamps: true },
)

// ─── Attempt ─────────────────────────────────────────────────────────────────

const AttemptSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    examId: { type: String, required: true },
    userId: { type: String, required: true },
    startedAt: { type: String, required: true },
    submittedAt: String,
    answers: { type: [AnswerSchema], default: [] },
    score: Number,
    correct: Number,
    incorrect: Number,
    instituteId: { type: String },
  },
  { timestamps: true },
)

// ─── Export models (hot-reload safe: reuse compiled model if already defined) ─

export const InstituteModel = models.Institute ?? model('Institute', InstituteSchema)
export const UserModel = models.User ?? model('User', UserSchema)
export const RoomModel = models.Room ?? model('Room', RoomSchema)
export const ExamModel = models.Exam ?? model('Exam', ExamSchema)
export const AttemptModel = models.Attempt ?? model('Attempt', AttemptSchema)
