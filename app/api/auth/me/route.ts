import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { UserModel } from '@/lib/models'
import type { User } from '@/lib/exam-types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ user: null })

    await connectDB()
    const dbUser = await UserModel.findOne({ id: userId }).lean()
    if (!dbUser) return NextResponse.json({ user: null })

    const user: User = {
      id: dbUser.id as string,
      name: dbUser.name as string,
      email: dbUser.email as string,
      password: '',
      role: dbUser.role as 'owner' | 'admin' | 'student',
      roomIds: (dbUser.roomIds as string[]) ?? [],
      instituteId: (dbUser.instituteId as string) || undefined,
      status: ((dbUser as any).status as 'active' | 'inactive') ?? 'active',
    }
    return NextResponse.json({ user })
  } catch (err) {
    console.error('[GET /api/auth/me]', err)
    if (err instanceof Error && err.message.includes('MONGODB_URI')) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
    }
    // On any error, treat as unauthenticated rather than crashing
    return NextResponse.json({ user: null })
  }
}
