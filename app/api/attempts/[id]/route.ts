import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { UserModel, AttemptModel } from '@/lib/models'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const adminId = await getSessionUserId()
    if (!adminId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const { id } = await params
    await connectDB()

    const admin = await UserModel.findOne({ id: adminId, role: { $in: ['admin', 'owner'] } }).lean()
    if (!admin) {
      return NextResponse.json({ error: 'Only admins or owners can reset exam attempts.' }, { status: 403 })
    }

    await AttemptModel.deleteOne({ id })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/attempts/[id]]', err)
    return NextResponse.json({ error: 'Failed to reset attempt.' }, { status: 500 })
  }
}
