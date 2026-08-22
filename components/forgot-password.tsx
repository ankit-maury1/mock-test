'use client'

import { useState, useEffect } from 'react'
import { KeyRound, Mail, ArrowLeft, CheckCircle, AlertCircle, Loader2, ShieldCheck } from 'lucide-react'
import { Field, Logo } from './ui-bits'

export function ForgotPassword({
  onBackToLogin,
}: {
  onBackToLogin: () => void
}) {
  const [step, setStep] = useState<'request' | 'verify' | 'success'>('request')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(600) // 10 minutes timer in seconds

  // Timer for OTP expiration countdown
  useEffect(() => {
    if (step !== 'verify') return
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [step])

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  // Step 1: Request OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Please enter a valid email address.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to send reset code.')
      } else {
        setStep('verify')
        setCountdown(600)
        setSuccessMsg('A 6-digit verification code has been sent to your email.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Step 2 & 3: Verify OTP and Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otp.trim() || otp.trim().length !== 6) {
      setError('Please enter the 6-digit code sent to your email.')
      return
    }
    if (!newPassword || newPassword.length < 4) {
      setError('New password must be at least 4 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (countdown <= 0) {
      setError('The code has expired. Please request a new one.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: otp.trim(),
          newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to reset password.')
      } else {
        setStep('success')
        setSuccessMsg(data.message || 'Password reset successfully!')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-3xl border bg-card shadow-xl p-8">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <button
            onClick={onBackToLogin}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={14} /> Back to Sign In
          </button>
        </div>

        {step === 'request' && (
          <div>
            <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-1">
              <KeyRound size={18} /> Password Recovery
            </div>
            <h2 className="text-2xl font-bold">Reset Password</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Enter your registered email address and we&apos;ll send you a 6-digit verification code.
            </p>

            <form onSubmit={handleRequestOtp} className="mt-6 flex flex-col gap-4">
              <Field
                label="Email address"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                autoFocus
              />

              {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={14} /> {error}</p>}

              <button type="submit" disabled={loading || !email.trim()} className="btn mt-2">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                Send Reset Code
              </button>
            </form>
          </div>
        )}

        {step === 'verify' && (
          <div>
            <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-1">
              <ShieldCheck size={18} /> Code Verification
            </div>
            <h2 className="text-2xl font-bold">Enter Verification Code</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              We sent a 6-digit code to <strong>{email}</strong>. Code expires in{' '}
              <span className="font-mono font-bold text-primary">{formatTime(countdown)}</span>.
            </p>

            {successMsg && (
              <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle size={14} className="shrink-0" /> {successMsg}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="mt-4 flex flex-col gap-4">
              <Field
                label="6-Digit OTP Code"
                name="otp"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                required
                autoFocus
              />

              <Field
                label="New Password"
                name="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 4 characters"
                required
              />

              <Field
                label="Confirm New Password"
                name="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
              />

              {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={14} /> {error}</p>}

              <div className="flex flex-col gap-2 mt-2">
                <button type="submit" disabled={loading || otp.length !== 6 || !newPassword} className="btn">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                  Reset Password
                </button>

                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={loading}
                  className="btn secondary text-xs"
                >
                  Resend Code
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-4 space-y-4">
            <div className="grid size-16 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 mx-auto">
              <CheckCircle size={32} />
            </div>
            <h2 className="text-2xl font-bold">Password Changed!</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your password has been successfully updated. You can now log in to your account with your new password.
            </p>

            <button onClick={onBackToLogin} className="btn w-full mt-4">
              Proceed to Sign In &rarr;
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
