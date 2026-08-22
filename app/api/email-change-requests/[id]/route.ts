import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { UserModel, EmailChangeRequestModel, InstituteModel } from '@/lib/models'
import { sendMail } from '@/lib/mailer'
import { emailChangeApprovedEmail, emailChangeRejectedEmail } from '@/lib/email-templates'

/**
 * PATCH /api/email-change-requests/[id] — Owner approves or rejects an email change request.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    await connectDB()

    const owner = await UserModel.findOne({ id: userId }).lean()
    if (!owner || (owner as any).role !== 'owner') {
      return NextResponse.json({ error: 'Only the owner can review email change requests.' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json().catch(() => null) as { action?: unknown } | null
    const action = String(body?.action ?? '').trim().toLowerCase()

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'Action must be "approve" or "reject".' }, { status: 400 })
    }

    const ecr = await EmailChangeRequestModel.findOne({ id, status: 'pending' }).lean()
    if (!ecr) {
      return NextResponse.json({ error: 'Request not found or already reviewed.' }, { status: 404 })
    }

    const requestUser = await UserModel.findOne({ id: (ecr as any).userId }).lean()
    if (!requestUser) {
      return NextResponse.json({ error: 'The user who made this request no longer exists.' }, { status: 404 })
    }

    // Get institute name for email branding
    let instituteName: string | undefined
    if ((requestUser as any).instituteId) {
      const institute = await InstituteModel.findOne({ id: (requestUser as any).instituteId }).lean()
      if (institute) instituteName = (institute as any).name
    }

    const currentEmail = (ecr as any).currentEmail as string
    const newEmail = (ecr as any).newEmail as string
    const userName = requestUser.name as string

    if (action === 'approve') {
      // Check if the new email is still available
      const emailTaken = await UserModel.findOne({ email: newEmail }).lean()
      if (emailTaken) {
        return NextResponse.json(
          { error: 'The requested email is now taken by another user. Rejecting automatically.' },
          { status: 409 },
        )
      }

      // Update the user's email
      await UserModel.updateOne(
        { id: (ecr as any).userId },
        { $set: { email: newEmail } },
      )

      // Mark request as approved
      await EmailChangeRequestModel.updateOne(
        { id },
        { $set: { status: 'approved', reviewedBy: userId, reviewedAt: new Date().toISOString() } },
      )

      // Send notification to OLD email
      sendMail({
        to: currentEmail,
        subject: `Email Address Update Notice - ${instituteName || 'Mock Test Platform'}`,
        html: emailChangeApprovedEmail({
          userName,
          oldEmail: currentEmail,
          newEmail,
          instituteName,
          recipient: 'old',
        }),
      })

      // Send notification to NEW email
      sendMail({
        to: newEmail,
        subject: `Email Address Linked - ${instituteName || 'Mock Test Platform'}`,
        html: emailChangeApprovedEmail({
          userName,
          oldEmail: currentEmail,
          newEmail,
          instituteName,
          recipient: 'new',
        }),
      })

      return NextResponse.json({ message: 'Email change approved. User email has been updated.' })
    } else {
      // Reject
      await EmailChangeRequestModel.updateOne(
        { id },
        { $set: { status: 'rejected', reviewedBy: userId, reviewedAt: new Date().toISOString() } },
      )

      // Send rejection notification to current email only
      sendMail({
        to: currentEmail,
        subject: `Email Address Update Request Status - ${instituteName || 'Mock Test Platform'}`,
        html: emailChangeRejectedEmail({
          userName,
          currentEmail,
          requestedEmail: newEmail,
          instituteName,
        }),
      })

      return NextResponse.json({ message: 'Email change request rejected.' })
    }
  } catch (err) {
    console.error('[PATCH /api/email-change-requests/[id]]', err)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}
