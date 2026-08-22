/**
 * Clean, professional, transactional HTML email templates.
 * Filtered to remove spam trigger words, emojis, and aggressive marketing elements.
 */

// ─── Shared styles ───────────────────────────────────────────────────────────

const BRAND_COLOR = '#4f46e5' // Indigo-600
const BG_COLOR = '#f8fafc'
const CARD_BG = '#ffffff'
const TEXT_COLOR = '#0f172a'
const MUTED_COLOR = '#475569'
const BORDER_COLOR = '#e2e8f0'

function baseLayout(content: string, preheader?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<meta name="color-scheme" content="light"/>
<meta name="supported-color-schemes" content="light"/>
${preheader ? `<span style="display:none;font-size:0;color:${BG_COLOR};max-height:0;overflow:hidden">${preheader}</span>` : ''}
<style>
  body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: ${BG_COLOR}; color: ${TEXT_COLOR}; }
  .container { max-width: 580px; margin: 0 auto; padding: 32px 16px; }
  .card { background: ${CARD_BG}; border-radius: 12px; border: 1px solid ${BORDER_COLOR}; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
  .header { background: #ffffff; border-bottom: 2px solid ${BRAND_COLOR}; padding: 24px 28px; }
  .header h1 { color: ${TEXT_COLOR}; font-size: 20px; font-weight: 700; margin: 0; letter-spacing: -0.2px; }
  .header p { color: ${MUTED_COLOR}; font-size: 13px; margin: 4px 0 0; }
  .body { padding: 28px; }
  .body h2 { font-size: 17px; font-weight: 600; margin: 0 0 14px; color: ${TEXT_COLOR}; }
  .body p { font-size: 14px; line-height: 1.6; color: ${MUTED_COLOR}; margin: 0 0 16px; }
  .info-box { background: #f8fafc; border: 1px solid ${BORDER_COLOR}; border-radius: 10px; padding: 18px; margin: 20px 0; }
  .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid ${BORDER_COLOR}; font-size: 14px; }
  .info-row:last-child { border-bottom: none; }
  .info-label { font-weight: 600; color: ${TEXT_COLOR}; }
  .info-value { color: ${MUTED_COLOR}; text-align: right; word-break: break-all; }
  .otp-box { text-align: center; margin: 24px 0; }
  .otp-code { display: inline-block; font-size: 32px; font-weight: 700; letter-spacing: 6px; padding: 14px 28px; background: #f1f5f9; border: 1px solid ${BORDER_COLOR}; border-radius: 10px; color: ${BRAND_COLOR}; font-family: monospace; }
  .btn { display: inline-block; padding: 11px 24px; background: ${BRAND_COLOR}; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; text-align: center; }
  .footer { text-align: center; padding: 20px 28px; background: #f8fafc; border-top: 1px solid ${BORDER_COLOR}; }
  .footer p { font-size: 12px; color: ${MUTED_COLOR}; margin: 0; line-height: 1.5; }
  .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
  .badge-success { background: #dcfce7; color: #166534; }
  .badge-danger { background: #fee2e2; color: #991b1b; }
  .badge-info { background: #e0e7ff; color: #3730a3; }
  .divider { border: none; border-top: 1px solid ${BORDER_COLOR}; margin: 20px 0; }
  .security-notice { background: #f8fafc; border: 1px solid ${BORDER_COLOR}; border-radius: 8px; padding: 14px; margin: 20px 0; font-size: 13px; color: ${MUTED_COLOR}; }
</style>
</head>
<body>
<div class="container">
  ${content}
</div>
</body>
</html>`
}

// ─── 1. Welcome Student Email ────────────────────────────────────────────────

export function welcomeStudentEmail(params: {
  instituteName: string
  studentName: string
  email: string
  password: string
  loginUrl?: string
}): string {
  const { instituteName, studentName, email, password, loginUrl } = params
  return baseLayout(`
<div class="card">
  <div class="header">
    <h1>Account Registration</h1>
    <p>${instituteName}</p>
  </div>
  <div class="body">
    <h2>Hello ${studentName},</h2>
    <p>
      An account has been created for you at <strong>${instituteName}</strong>.
      Below are your login credentials to access your courses and assessments:
    </p>
    <div class="info-box">
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};font-weight:600;color:${TEXT_COLOR}">Institute</td>
          <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};color:${MUTED_COLOR};text-align:right">${instituteName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};font-weight:600;color:${TEXT_COLOR}">Name</td>
          <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};color:${MUTED_COLOR};text-align:right">${studentName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};font-weight:600;color:${TEXT_COLOR}">Email</td>
          <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};color:${MUTED_COLOR};text-align:right">${email}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-weight:600;color:${TEXT_COLOR}">Password</td>
          <td style="padding:8px 0;color:${MUTED_COLOR};text-align:right"><code style="background:#f1f5f9;padding:2px 8px;border-radius:4px;font-family:monospace">${password}</code></td>
        </tr>
      </table>
    </div>
    <p>
      For account security, please change your password after logging in for the first time.
    </p>
    ${loginUrl ? `<p style="text-align:center;margin:24px 0"><a href="${loginUrl}" class="btn">Sign In to Account</a></p>` : ''}
    <div class="security-notice">
      <strong>Security Notice:</strong> Keep your login credentials confidential.
      If you did not expect this email, please contact your institute administrator.
    </div>
  </div>
  <div class="footer">
    <p>Sent by ${instituteName} via Mock Test Platform.<br/>This is an automated operational notification.</p>
  </div>
</div>
`, `Your account details for ${instituteName}.`)
}

// ─── 2. Welcome Admin Email ──────────────────────────────────────────────────

export function welcomeAdminEmail(params: {
  instituteName: string
  adminName: string
  email: string
  password: string
  loginUrl?: string
}): string {
  const { instituteName, adminName, email, password, loginUrl } = params
  return baseLayout(`
<div class="card">
  <div class="header">
    <h1>Administrator Account Created</h1>
    <p>${instituteName}</p>
  </div>
  <div class="body">
    <h2>Hello ${adminName},</h2>
    <p>
      You have been assigned administrator permissions for <strong>${instituteName}</strong>.
      You can now manage classrooms, configure assessments, and oversee student records.
    </p>
    <div class="info-box">
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};font-weight:600;color:${TEXT_COLOR}">Institute</td>
          <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};color:${MUTED_COLOR};text-align:right">${instituteName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};font-weight:600;color:${TEXT_COLOR}">Name</td>
          <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};color:${MUTED_COLOR};text-align:right">${adminName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};font-weight:600;color:${TEXT_COLOR}">Email</td>
          <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};color:${MUTED_COLOR};text-align:right">${email}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-weight:600;color:${TEXT_COLOR}">Password</td>
          <td style="padding:8px 0;color:${MUTED_COLOR};text-align:right"><code style="background:#f1f5f9;padding:2px 8px;border-radius:4px;font-family:monospace">${password}</code></td>
        </tr>
      </table>
    </div>
    ${loginUrl ? `<p style="text-align:center;margin:24px 0"><a href="${loginUrl}" class="btn">Open Administrator Console</a></p>` : ''}
    <div class="security-notice">
      <strong>Security Notice:</strong> Please update your password upon initial sign-in.
      Administrator credentials provide elevated permissions—maintain their confidentiality.
    </div>
  </div>
  <div class="footer">
    <p>Sent by ${instituteName} via Mock Test Platform.<br/>This is an automated operational notification.</p>
  </div>
</div>
`, `Administrator access details for ${instituteName}.`)
}

// ─── 3. Password Reset OTP Email ─────────────────────────────────────────────

export function passwordResetOtpEmail(params: {
  userName: string
  otp: string
  expiryMinutes?: number
  instituteName?: string
}): string {
  const { userName, otp, expiryMinutes = 10, instituteName } = params
  return baseLayout(`
<div class="card">
  <div class="header">
    <h1>Password Reset Request</h1>
    <p>${instituteName || 'Mock Test Platform'}</p>
  </div>
  <div class="body">
    <h2>Hello ${userName},</h2>
    <p>
      A password reset request was submitted for your account. Please use the verification code below to complete the reset process.
      This code is valid for <strong>${expiryMinutes} minutes</strong>.
    </p>
    <div class="otp-box">
      <div class="otp-code">${otp}</div>
    </div>
    <p style="text-align:center;font-size:13px;color:${MUTED_COLOR}">
      Enter this code on the verification screen to proceed.
    </p>
    <hr class="divider"/>
    <div class="security-notice">
      If you did not request a password reset, no action is required. Your current password remains active and secure.
    </div>
  </div>
  <div class="footer">
    <p>Automated security notification from ${instituteName || 'Mock Test Platform'}. Please do not reply.</p>
  </div>
</div>
`, `Verification code for password reset: ${otp}`)
}

// ─── 4. Email Change Approved ────────────────────────────────────────────────

export function emailChangeApprovedEmail(params: {
  userName: string
  oldEmail: string
  newEmail: string
  instituteName?: string
  recipient: 'old' | 'new'
}): string {
  const { userName, oldEmail, newEmail, instituteName, recipient } = params
  const isOldRecipient = recipient === 'old'
  return baseLayout(`
<div class="card">
  <div class="header">
    <h1>Email Address Updated</h1>
    <p>${instituteName || 'Mock Test Platform'}</p>
  </div>
  <div class="body">
    <h2>Hello ${userName},</h2>
    ${isOldRecipient
      ? `<p>The email address change request for your account has been approved and processed.</p>`
      : `<p>This email address is now primary for your account following an approved email update.</p>`
    }
    <div class="info-box">
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};font-weight:600;color:${TEXT_COLOR}">Previous Email</td>
          <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};color:${MUTED_COLOR};text-align:right">${oldEmail}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-weight:600;color:${TEXT_COLOR}">New Email</td>
          <td style="padding:8px 0;color:#15803d;font-weight:600;text-align:right">${newEmail}</td>
        </tr>
      </table>
    </div>
    <div class="security-notice">
      If you did not authorize this email update, please inform your platform administrator immediately.
    </div>
  </div>
  <div class="footer">
    <p>Automated notification from ${instituteName || 'Mock Test Platform'}.</p>
  </div>
</div>
`, `Email address updated from ${oldEmail} to ${newEmail}.`)
}

// ─── 5. Email Change Rejected ────────────────────────────────────────────────

export function emailChangeRejectedEmail(params: {
  userName: string
  currentEmail: string
  requestedEmail: string
  instituteName?: string
}): string {
  const { userName, currentEmail, requestedEmail, instituteName } = params
  return baseLayout(`
<div class="card">
  <div class="header">
    <h1>Email Address Update Request Status</h1>
    <p>${instituteName || 'Mock Test Platform'}</p>
  </div>
  <div class="body">
    <h2>Hello ${userName},</h2>
    <p>
      Your request to update your account email address was not approved by the administrator.
    </p>
    <div class="info-box">
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};font-weight:600;color:${TEXT_COLOR}">Current Email (Active)</td>
          <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};color:${MUTED_COLOR};text-align:right">${currentEmail}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-weight:600;color:${TEXT_COLOR}">Requested Email</td>
          <td style="padding:8px 0;color:#b91c1c;text-decoration:line-through;text-align:right">${requestedEmail}</td>
        </tr>
      </table>
    </div>
    <p>
      Your account email address remains <strong>${currentEmail}</strong>.
    </p>
  </div>
  <div class="footer">
    <p>Automated notification from ${instituteName || 'Mock Test Platform'}.</p>
  </div>
</div>
`, `Email update request was not approved. Your email remains ${currentEmail}.`)
}

// ─── 6. New Institute Pending Notice Email (to Owner) ────────────────────────

export function newInstitutePendingNoticeEmail(params: {
  ownerName: string
  adminName: string
  adminEmail: string
  instituteName: string
  description?: string
  dashboardUrl?: string
}): string {
  const { ownerName, adminName, adminEmail, instituteName, description, dashboardUrl } = params
  return baseLayout(`
<div class="card">
  <div class="header">
    <h1>New Institute Registration Request</h1>
    <p>Owner Approval Required</p>
  </div>
  <div class="body">
    <h2>Hello ${ownerName},</h2>
    <p>
      A new administrator account and institute registration has been submitted for review.
    </p>
    <div class="info-box">
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};font-weight:600;color:${TEXT_COLOR}">Institute Name</td>
          <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};color:${TEXT_COLOR};font-weight:600;text-align:right">${instituteName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};font-weight:600;color:${TEXT_COLOR}">Admin Name</td>
          <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};color:${MUTED_COLOR};text-align:right">${adminName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};font-weight:600;color:${TEXT_COLOR}">Admin Email</td>
          <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};color:${MUTED_COLOR};text-align:right">${adminEmail}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-weight:600;color:${TEXT_COLOR}">Description</td>
          <td style="padding:8px 0;color:${MUTED_COLOR};text-align:right">${description || 'Not provided'}</td>
        </tr>
      </table>
    </div>
    ${dashboardUrl ? `<p style="text-align:center;margin:24px 0"><a href="${dashboardUrl}" class="btn">Review Request in Owner Console</a></p>` : ''}
  </div>
  <div class="footer">
    <p>Mock Test Platform • Owner Console Notification</p>
  </div>
</div>
`, `New Institute Registration Request: ${instituteName}`)
}

// ─── 7. Institute Approved Email (to Admin) ──────────────────────────────────

export function instituteApprovedEmail(params: {
  adminName: string
  instituteName: string
  loginUrl?: string
}): string {
  const { adminName, instituteName, loginUrl } = params
  return baseLayout(`
<div class="card">
  <div class="header">
    <h1>Institute Registration Approved</h1>
    <p>${instituteName}</p>
  </div>
  <div class="body">
    <h2>Hello ${adminName},</h2>
    <p>
      Your registration request for <strong>${instituteName}</strong> has been approved by the platform administration.
    </p>
    <p>
      Your Institute Workspace is active. You can sign in to create classrooms, publish assessments, manage students, and configure institute settings.
    </p>
    ${loginUrl ? `<p style="text-align:center;margin:24px 0"><a href="${loginUrl}" class="btn">Access Institute Workspace</a></p>` : ''}
  </div>
  <div class="footer">
    <p>Mock Test Platform • Operational Notification</p>
  </div>
</div>
`, `Registration approved for ${instituteName}.`)
}

// ─── 8. Institute Rejected Email (to Admin) ──────────────────────────────────

export function instituteRejectedEmail(params: {
  adminName: string
  instituteName: string
  rejectionReason?: string
}): string {
  const { adminName, instituteName, rejectionReason } = params
  return baseLayout(`
<div class="card">
  <div class="header">
    <h1>Institute Registration Request Decision</h1>
    <p>${instituteName}</p>
  </div>
  <div class="body">
    <h2>Hello ${adminName},</h2>
    <p>
      Thank you for submitting your registration request for <strong>${instituteName}</strong>.
      Following review, your registration request was not approved by the platform administration.
    </p>
    ${
      rejectionReason
        ? `
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 6px;font-weight:700;color:#991b1b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Reason for Rejection:</p>
      <p style="margin:0;color:#7f1d1d;font-size:14px;line-height:1.5">${rejectionReason}</p>
    </div>
    `
        : ''
    }
    <p>
      If you need further information or have questions regarding this decision, please contact platform support.
    </p>
  </div>
  <div class="footer">
    <p>Mock Test Platform • Operational Notification</p>
  </div>
</div>
`, `Registration status update for ${instituteName}.`)
}
