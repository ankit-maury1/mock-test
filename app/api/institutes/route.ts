import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { UserModel, InstituteModel } from '@/lib/models'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    await connectDB()
    const user = await UserModel.findOne({ id: userId }).lean()
    if (!user || (user as any).role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can access institutes.' }, { status: 403 })
    }

    const institutes = await InstituteModel.find({}).sort({ name: 1 }).lean()
    return NextResponse.json({ institutes })
  } catch (err) {
    console.error('[GET /api/institutes]', err)
    return NextResponse.json({ error: 'Failed to fetch institutes.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    await connectDB()
    const user = await UserModel.findOne({ id: userId }).lean()
    if (!user || (user as any).role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can create institutes.' }, { status: 403 })
    }

    const body = await request.json().catch(() => null) as { name?: unknown; description?: unknown } | null
    const name = String(body?.name ?? '').trim()
    const description = String(body?.description ?? '').trim()

    if (!name) {
      return NextResponse.json({ error: 'Institute name is required.' }, { status: 400 })
    }
    if (name.length > 120) {
      return NextResponse.json({ error: 'Institute name too long.' }, { status: 400 })
    }

    const id = crypto.randomUUID()
    const institute = await InstituteModel.create({ id, name, description })

    return NextResponse.json({ institute }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/institutes]', err)
    return NextResponse.json({ error: 'Failed to create institute.' }, { status: 500 })
  }
}
