import { NextResponse } from 'next/server'
import { serverEnv } from '@/lib/env'

const MAX_BYTES = 6 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'])

/** Minimal magic-byte detection to guard against Content-Type spoofing. */
function isMimeConsistent(bytes: Uint8Array, declaredType: string): boolean {
  const sigs: Record<string, number[]> = {
    'image/jpeg': [0xff, 0xd8, 0xff],
    'image/png': [0x89, 0x50, 0x4e, 0x47],
    'image/gif': [0x47, 0x49, 0x46],
  }
  const expected = sigs[declaredType]
  if (!expected) return true // Can't verify webp/avif easily — trust Content-Type
  return expected.every((b, i) => bytes[i] === b)
}

/**
 * ImgBB upload endpoint.
 * Returns { url, deleteUrl } — store deleteUrl on the question for future cleanup.
 * Without IMGBB_API_KEY this responds 501 and the client keeps the image inline.
 */
export async function POST(request: Request) {
  try {
    const apiKey = serverEnv.IMGBB_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'IMGBB_API_KEY is not configured.' }, { status: 501 })
    }

    const form = await request.formData()
    const file = form.get('image')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No image provided.' }, { status: 400 })
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: 'Only JPEG, PNG, GIF, WebP, or AVIF images are allowed.' },
        { status: 400 },
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image must be 6 MB or smaller.' }, { status: 413 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)

    if (!isMimeConsistent(bytes, file.type)) {
      return NextResponse.json(
        { error: 'File content does not match its declared type.' },
        { status: 400 },
      )
    }

    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const body = new URLSearchParams({ image: base64 })

    const imgbbRes = await fetch(
      `https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`,
      { method: 'POST', body },
    )

    if (!imgbbRes.ok) {
      console.error('[upload] ImgBB error:', imgbbRes.status, await imgbbRes.text().catch(() => ''))
      return NextResponse.json({ error: 'ImgBB rejected the upload.' }, { status: 502 })
    }

    const payload = (await imgbbRes.json()) as {
      success?: boolean
      data?: {
        id?: string
        title?: string
        url?: string
        display_url?: string
        delete_url?: string
        image?: { url?: string }
        thumb?: { url?: string }
        medium?: { url?: string }
      }
    }

    if (!payload.success || !payload.data) {
      return NextResponse.json({ error: 'Unexpected response from ImgBB.' }, { status: 502 })
    }

    // Prefer display_url (medium/full size CDN) — fall back to url
    const url = payload.data.display_url ?? payload.data.url
    const deleteUrl = payload.data.delete_url

    if (!url) {
      return NextResponse.json({ error: 'ImgBB returned no image URL.' }, { status: 502 })
    }

    return NextResponse.json({ url, deleteUrl })
  } catch (err) {
    console.error('[POST /api/upload]', err)
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })
  }
}
