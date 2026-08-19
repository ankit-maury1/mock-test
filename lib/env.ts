/**
 * Server-only environment variable accessor.
 * Uses lazy property getters so each variable is validated only when first accessed.
 * Never import this in client components — use only in API routes and server utilities.
 */

function requireEnv(key: string): string {
  let val = (process.env[key] ?? '').trim()
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1).trim()
  }
  if (!val) {
    throw new Error(
      `[Axis] Required environment variable "${key}" is missing or empty.\n` +
        `Add it to your .env file:\n  ${key}=<your_value>\nthen restart the server.`,
    )
  }
  return val
}

export const serverEnv = {
  /** MongoDB Atlas connection URI — required for all data operations. */
  get MONGODB_URI() {
    return requireEnv('MONGODB_URI')
  },

  /**
   * Session-signing secret — derived from MONGODB_URI if not explicitly set.
   * In production, set AUTH_SECRET to a random 32-character string for maximum security.
   */
  get AUTH_SECRET() {
    const custom = (process.env.AUTH_SECRET ?? '').trim()
    if (custom) return custom
    const uri = requireEnv('MONGODB_URI')
    // Derive a stable secret from the URI so sessions survive server restarts.
    return uri.replace(/[^a-zA-Z0-9]/g, '').slice(-32).padStart(32, 'k')
  },

  /**
   * ImgBB API key — optional. When absent, image uploads fall back to inline base64 URLs.
   * Get yours at https://api.imgbb.com/
   */
  get IMGBB_API_KEY(): string | null {
    return (process.env.IMGBB_API_KEY ?? '').trim() || null
  },
}
