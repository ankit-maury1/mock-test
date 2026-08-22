import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { UserModel, InstituteModel, RoomModel, ExamModel } from '@/lib/models'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const { id } = await params
    await connectDB()

    const user = await UserModel.findOne({ id: userId }).lean()
    if (!user || (user as any).role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can update institutes.' }, { status: 403 })
    }

    const institute = await InstituteModel.findOne({ id })
    if (!institute) {
      return NextResponse.json({ error: 'Institute not found.' }, { status: 404 })
    }

    const body = await request.json().catch(() => null) as {
      name?: unknown
      description?: unknown
      status?: unknown
      rejectionReason?: unknown
    } | null

    const previousStatus = (institute as any).status
    if (previousStatus === 'rejected') {
      return NextResponse.json({ error: 'Rejected institutes cannot be re-approved or updated.' }, { status: 400 })
    }

    const update: Record<string, unknown> = {}

    if (body?.name !== undefined) {
      const name = String(body.name).trim()
      if (!name) return NextResponse.json({ error: 'Institute name cannot be empty.' }, { status: 400 })
      if (name.length > 120) return NextResponse.json({ error: 'Institute name too long.' }, { status: 400 })
      update.name = name
    }

    if (body?.description !== undefined) {
      update.description = String(body.description).trim()
    }

    if (body?.status !== undefined) {
      const status = String(body.status)
      if (status !== 'active' && status !== 'inactive' && status !== 'pending' && status !== 'rejected') {
        return NextResponse.json({ error: 'Status must be active, inactive, pending, or rejected.' }, { status: 400 })
      }
      update.status = status
      if (status === 'rejected' && body.rejectionReason !== undefined) {
        update.rejectionReason = String(body.rejectionReason).trim()
      }
    }

    await InstituteModel.updateOne({ id }, { $set: update })

    // ─── Fire-and-forget email notifications on status changes ────────
    if (update.status && update.status !== previousStatus) {
      try {
        const adminUsers = await UserModel.find({ instituteId: id, role: 'admin' }).lean()
        if (adminUsers.length) {
          const { sendMail } = await import('@/lib/mailer')
          const { instituteApprovedEmail, instituteRejectedEmail } = await import('@/lib/email-templates')

          for (const admin of adminUsers as any[]) {
            if (update.status === 'active') {
              sendMail({
                to: admin.email,
                subject: `Institute Registration Approved: ${institute.name}`,
                html: instituteApprovedEmail({
                  adminName: admin.name,
                  instituteName: institute.name,
                }),
              })
            } else if (update.status === 'rejected') {
              sendMail({
                to: admin.email,
                subject: `Institute Registration Status: ${institute.name}`,
                html: instituteRejectedEmail({
                  adminName: admin.name,
                  instituteName: institute.name,
                  rejectionReason: (update.rejectionReason as string) || undefined,
                }),
              })
            }
          }
        }
      } catch (e) {
        console.warn('[PATCH /api/institutes/[id]] Email notification failed:', e)
      }
    }
    // ─────────────────────────────────────────────────────────────────

    return NextResponse.json({ ok: true, update })
  } catch (err) {
    console.error('[PATCH /api/institutes/[id]]', err)
    return NextResponse.json({ error: 'Failed to update institute.' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const { id } = await params
    await connectDB()

    const user = await UserModel.findOne({ id: userId }).lean()
    if (!user || (user as any).role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can delete institutes.' }, { status: 403 })
    }

    const institute = await InstituteModel.findOne({ id })
    if (!institute) {
      return NextResponse.json({ error: 'Institute not found.' }, { status: 404 })
    }

    // Delete institute and clean up associated entities
    await Promise.all([
      InstituteModel.deleteOne({ id }),
      UserModel.deleteMany({ instituteId: id, role: { $ne: 'owner' } }),
      RoomModel.deleteMany({ instituteId: id }),
      ExamModel.deleteMany({ instituteId: id }),
    ])

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/institutes/[id]]', err)
    return NextResponse.json({ error: 'Failed to delete institute.' }, { status: 500 })
  }
}
