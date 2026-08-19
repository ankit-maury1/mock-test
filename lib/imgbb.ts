export interface UploadResult {
  url: string
  /** ImgBB delete_url — present only when the image was hosted on ImgBB. Store this alongside the question to enable permanent deletion. */
  deleteUrl?: string
  /** true when the file was uploaded to ImgBB, false when it stayed inline as a local data URL. */
  hosted: boolean
}

function toDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read the image file.'))
    reader.readAsDataURL(file)
  })
}

/**
 * Uploads a question image through /api/upload (ImgBB).
 * Returns { url, deleteUrl, hosted: true } on success.
 * When IMGBB_API_KEY is missing the route replies 501 and we fall back to an inline data URL,
 * which — unlike URL.createObjectURL — survives a page reload.
 * Throws on validation errors (wrong type, too large).
 */
export async function uploadQuestionImage(file: File): Promise<UploadResult> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.')
  if (file.size > 6 * 1024 * 1024) throw new Error('Image must be 6 MB or smaller.')

  try {
    const body = new FormData()
    body.append('image', file)
    const response = await fetch('/api/upload', { method: 'POST', body })

    if (response.ok) {
      const payload = (await response.json()) as { url: string; deleteUrl?: string }
      return { url: payload.url, deleteUrl: payload.deleteUrl, hosted: true }
    }

    // Propagate error messages from the API (400, 413, 502, etc.)
    if (response.status !== 501) {
      const err = await response.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error ?? `Upload failed (${response.status}).`)
    }
    // 501 = IMGBB_API_KEY not configured — fall through to inline copy
  } catch (err) {
    if (err instanceof Error && err.message !== 'Upload failed') throw err
    // Network failure: fall through to inline copy
  }

  return { url: await toDataUrl(file), hosted: false }
}

/**
 * Permanently deletes an image from ImgBB via the server-side proxy endpoint.
 * Fire-and-forget — call without await. Failures are silently ignored
 * since a broken delete is non-critical (the image just stays on ImgBB).
 */
export function deleteQuestionImage(deleteUrl: string | undefined): void {
  if (!deleteUrl) return
  fetch('/api/imgbb/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deleteUrl }),
  }).catch(() => {
    // Best effort — failure is non-critical
  })
}
