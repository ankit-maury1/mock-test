import bcrypt from 'bcryptjs'
import { connectDB } from './mongodb'
import { UserModel, RoomModel, ExamModel, AttemptModel, InstituteModel } from './models'
import { seedData } from './exam-store'

const SALT_ROUNDS = 10

/**
 * Seeds MongoDB with demo data the first time the database is empty.
 * This ensures the app is usable immediately after first deploy without any manual setup.
 * Idempotent — safe to call on every request.
 */
export async function seedIfEmpty(): Promise<void> {
  await connectDB()
  const count = await UserModel.countDocuments()
  if (count > 0) return // Already seeded — skip

  console.log('[Axis] Empty database detected — seeding with demo data...')

  // Seed default institute
  await InstituteModel.create({
    id: 'inst-1',
    name: 'Prayas Coaching Institute',
    description: 'Main campus coaching institute',
    status: 'active',
  })

  // Seed owner account
  const ownerHash = await bcrypt.hash('owner123', SALT_ROUNDS)
  const ownerUser = {
    id: 'usr_owner',
    name: 'Owner',
    email: 'owner@gmail.com',
    passwordHash: ownerHash,
    role: 'owner' as const,
    roomIds: [] as string[],
    instituteId: undefined as string | undefined,
    status: 'active' as const,
  }

  const users = await Promise.all(
    seedData.users
      .filter((user) => user.role !== 'owner')
      .map(async (user) => {
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          passwordHash: await bcrypt.hash(user.password, SALT_ROUNDS),
          role: user.role,
          roomIds: user.roomIds,
          instituteId: 'inst-1' as string | undefined,
          status: 'active' as const,
        }
      }),
  )

  users.push(ownerUser)

  const rooms = seedData.rooms.map((room) => ({ ...room, instituteId: 'inst-1' }))
  const exams = seedData.exams.map((exam) => ({
    ...exam,
    questions: exam.questions.map((q) => ({ ...q, deleteUrl: undefined })),
    instituteId: 'inst-1',
  }))
  const attempts = seedData.attempts.map((attempt) => ({ ...attempt, instituteId: 'inst-1' }))

  await Promise.all([
    UserModel.insertMany(users),
    RoomModel.insertMany(rooms),
    ExamModel.insertMany(exams),
    AttemptModel.insertMany(attempts),
  ])

  console.log('[Axis] Demo data seeded. Login: owner@gmail.com / owner123')
}
