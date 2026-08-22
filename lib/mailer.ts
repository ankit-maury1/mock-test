/**
 * Email sending utility using Nodemailer with Gmail SMTP.
 * Gracefully degrades when email env vars are not configured —
 * operations succeed but emails are skipped with a console warning.
 */

import nodemailer from 'nodemailer'

// ─── Configuration ───────────────────────────────────────────────────────────

function getEmailConfig() {
  const host = (process.env.EMAIL_SERVER_HOST ?? '').trim()
  const port = parseInt(process.env.EMAIL_SERVER_PORT ?? '587', 10)
  const user = (process.env.EMAIL_SERVER_USER ?? '').trim()
  const pass = (process.env.EMAIL_SERVER_PASSWORD ?? '').trim()
  const from = (process.env.EMAIL_FROM ?? '').trim()

  if (!host || !user || !pass || !from) {
    return null
  }

  return { host, port, user, pass, from }
}

// ─── Transporter (lazy singleton) ────────────────────────────────────────────

let _transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter | null {
  if (_transporter) return _transporter

  const config = getEmailConfig()
  if (!config) {
    console.warn(
      '[Mailer] Email environment variables not configured. ' +
      'Set EMAIL_SERVER_HOST, EMAIL_SERVER_USER, EMAIL_SERVER_PASSWORD, and EMAIL_FROM in .env.local to enable email sending.'
    )
    return null
  }

  _transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465, // true for 465 (SSL), false for 587 (TLS)
    auth: {
      user: config.user,
      pass: config.pass,
    },
    pool: true,
    maxConnections: 3,
  })

  return _transporter
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface MailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

/**
 * Sends an email. Returns true if sent, false if email is not configured or sending failed.
 * Never throws — failures are logged as warnings.
 */
export async function sendMail(options: MailOptions): Promise<boolean> {
  const config = getEmailConfig()
  const transporter = getTransporter()

  if (!transporter || !config) {
    console.warn(`[Mailer] Skipping email to ${options.to}: Email not configured.`)
    return false
  }

  const plainText =
    options.text ||
    options.html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  try {
    await transporter.sendMail({
      from: config.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: plainText,
      headers: {
        'Auto-Submitted': 'auto-generated',
        'X-Auto-Response-Suppress': 'All',
      },
    })
    console.log(`[Mailer] ✓ Email sent to ${options.to}: "${options.subject}"`)
    return true
  } catch (err) {
    console.error(`[Mailer] ✗ Failed to send email to ${options.to}:`, err)
    return false
  }
}
