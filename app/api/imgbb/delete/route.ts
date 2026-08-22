import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth'

const IMGBB_DELETE_PREFIX = 'https://ibb.co/'

/**
 * Permanently deletes an image   by visiting its delete_url.
 * ImgBB uses a secret hash in the URL for authentication — no API key needed for deletion.
 */
export async function POST(request: Request) {
  try {
    // Require authentication to prevent abuse
    const userId = await getSessionUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const body = await request.json().catch(() => null) as { deleteUrl?: unknown } | null
    const deleteUrl = String(body?.deleteUrl ?? '').trim()

    if (!deleteUrl) {
      return NextResponse.json({ error: 'deleteUrl is required.' }, { status: 400 })
    }

    // Validate it's a genuine ImgBB delete URL to prevent SSRF attacks
    if (!deleteUrl.startsWith(IMGBB_DELETE_PREFIX)) {
      return NextResponse.json({ error: 'Invalid ImgBB delete URL.' }, { status: 400 })
    }

    // ImgBB deletes the image when the delete_url is visited (GET request)
    const res = await fetch(deleteUrl, { method: 'GET', redirect: 'follow' })

    // ImgBB returns an HTML page for both success and failure — any non-4xx is fine
    if (res.status >= 400) {
      console.warn('[imgbb/delete] ImgBB responded:', res.status)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/imgbb/delete]', err)
    return NextResponse.json({ error: 'Failed to delete image  .' }, { status: 500 })
  }
}
