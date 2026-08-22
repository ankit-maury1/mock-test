import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { UserModel, EmailChangeRequestModel } from '@/lib/models'

/**
 * GET /api/email-change-requests — Owner fetches all pending email change requests.
 */
export async function GET() {
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    await connectDB()

    const user = await UserModel.findOne({ id: userId }).lean()
    if (!user || (user as any).role !== 'owner') {
      return NextResponse.json({ error: 'Only the owner can view email change requests.' }, { status: 403 })
    }

    const requests = await EmailChangeRequestModel.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .lean()

    // Enrich with user names
    const enriched = await Promise.all(
      requests.map(async (req: any) => {
        const reqUser = await UserModel.findOne({ id: req.userId }).lean()
        return {
          id: req.id,
          userId: req.userId,
          userName: reqUser?.name ?? 'Unknown',
          userRole: reqUser?.role ?? 'unknown',
          currentEmail: req.currentEmail,
          newEmail: req.newEmail,
          status: req.status,
          createdAt: req.createdAt,
        }
      }),
    )

    return NextResponse.json({ requests: enriched })
  } catch (err) {
    console.error('[GET /api/email-change-requests]', err)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}

/**
 * POST /api/email-change-requests — Admin submits a request to change their email.
 */
export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    await connectDB()

    const user = await UserModel.findOne({ id: userId }).lean()
    if (!user) return NextResponse.json({ error: 'Account not found.' }, { status: 404 })

    // Only admins need to request — owners can change directly
    if ((user as any).role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins need to request email changes. Owners can change directly.' },
        { status: 403 },
      )
    }

    const body = await request.json().catch(() => null) as { newEmail?: unknown } | null
    const newEmail = String(body?.newEmail ?? '').trim().toLowerCase()

    if (!newEmail) {
      return NextResponse.json({ error: 'New email address is required.' }, { status: 400 })
    }
    if (!/^\S+@\S+\.\S+$/.test(newEmail)) {
      return NextResponse.json({ error: 'Invalid email address format.' }, { status: 400 })
    }
    if (newEmail === (user as any).email) {
      return NextResponse.json({ error: 'New email is the same as your current email.' }, { status: 400 })
    }

    // Check if the new email is already taken
    const emailTaken = await UserModel.findOne({ email: newEmail }).lean()
    if (emailTaken) {
      return NextResponse.json({ error: 'This email is already registered to another account.' }, { status: 409 })
    }

    // Check for existing pending request
    const existingPending = await EmailChangeRequestModel.findOne({
      userId: userId,
      status: 'pending',
    }).lean()
    if (existingPending) {
      return NextResponse.json(
        { error: 'You already have a pending email change request. Please wait for it to be reviewed.' },
        { status: 409 },
      )
    }

    const id = crypto.randomUUID()
    await EmailChangeRequestModel.create({
      id,
      userId: userId,
      currentEmail: (user as any).email,
      newEmail,
      status: 'pending',
    })

    return NextResponse.json(
      { message: 'Your email change request has been submitted and is pending owner approval.' },
      { status: 201 },
    )
  } catch (err) {
    console.error('[POST /api/email-change-requests]', err)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}
