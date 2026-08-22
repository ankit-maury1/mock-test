'use client'

import { useState, useEffect } from 'react'
import {
  User,
  Lock,
  Mail,
  School,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { Field, Heading } from './ui-bits'
import type { User as UserType, Institute } from '@/lib/exam-types'

export function SettingsPage({
  user,
  institute,
  onUserUpdate,
  readOnly = false,
}: {
  user: UserType
  institute?: Institute | null
  onUserUpdate: (updatedUser: Partial<UserType>) => void
  readOnly?: boolean
}) {
  // Name edit state
  const [name, setName] = useState(user.name)
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState('')
  const [nameSuccess, setNameSuccess] = useState('')

  // Password edit state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  // Email change request state
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [submittingEmail, setSubmittingEmail] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [emailSuccess, setEmailSuccess] = useState('')
  const [pendingRequest, setPendingRequest] = useState<{
    id: string
    newEmail: string
    createdAt: string
  } | null>(null)

  // Keep state synced with user prop
  useEffect(() => {
    setName(user.name)
  }, [user.name])

  // Check for pending email change request on mount (if admin)
  useEffect(() => {
    if (user.role !== 'admin') return
    async function checkPendingRequest() {
      try {
        const res = await fetch('/api/email-change-requests')
        if (res.ok) {
          const data = await res.json()
          const myPending = (data.requests || []).find(
            (r: any) => r.userId === user.id && r.status === 'pending'
          )
          if (myPending) {
            setPendingRequest({
              id: myPending.id,
              newEmail: myPending.newEmail,
              createdAt: myPending.createdAt,
            })
          }
        }
      } catch {
        // Non-critical check
      }
    }
    checkPendingRequest()
  }, [user.id, user.role])

  // Save Name
  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setNameError('Name cannot be empty.')
      return
    }
    if (name.trim() === user.name) {
      setNameSuccess('Name is already up to date.')
      return
    }

    setSavingName(true)
    setNameError('')
    setNameSuccess('')
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setNameError(data.error || 'Failed to update name.')
      } else {
        setNameSuccess('Name updated successfully!')
        onUserUpdate({ name: name.trim() })
      }
    } catch {
      setNameError('Network error. Failed to update name.')
    } finally {
      setSavingName(false)
    }
  }

  // Save Password
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword) {
      setPasswordError('Please enter your current password.')
      return
    }
    if (!newPassword || newPassword.length < 4) {
      setPasswordError('New password must be at least 4 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.')
      return
    }

    setSavingPassword(true)
    setPasswordError('')
    setPasswordSuccess('')
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPasswordError(data.error || 'Failed to update password.')
      } else {
        setPasswordSuccess('Password changed successfully!')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch {
      setPasswordError('Network error. Failed to change password.')
    } finally {
      setSavingPassword(false)
    }
  }

  // Submit Email Change Request
  const handleSubmitEmailRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail.trim() || !/^\S+@\S+\.\S+$/.test(newEmail.trim())) {
      setEmailError('Please enter a valid email address.')
      return
    }
    if (newEmail.trim().toLowerCase() === user.email.toLowerCase()) {
      setEmailError('New email is the same as your current email.')
      return
    }

    setSubmittingEmail(true)
    setEmailError('')
    setEmailSuccess('')
    try {
      const res = await fetch('/api/email-change-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: newEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setEmailError(data.error || 'Failed to submit email change request.')
      } else {
        setEmailSuccess('Request submitted! Pending owner review.')
        setPendingRequest({
          id: 'temp',
          newEmail: newEmail.trim().toLowerCase(),
          createdAt: new Date().toISOString(),
        })
        setNewEmail('')
        setTimeout(() => setShowEmailModal(false), 1500)
      }
    } catch {
      setEmailError('Network error. Failed to submit request.')
    } finally {
      setSubmittingEmail(false)
    }
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <Heading
        eyebrow="Account & Preferences"
        title="Settings & Profile"
      />

      {readOnly && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
          ⚠️ You are in <strong>Impersonation Mode</strong>. Profile changes are disabled.
        </div>
      )}

      {/* Account Info Summary Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border bg-card p-6 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary font-bold text-xl">
            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{user.name}</h2>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="badge text-[11px] px-2 py-0.5 font-semibold border-primary/30 bg-primary/10 text-primary capitalize">
                {user.role}
              </span>
              {user.status === 'inactive' && (
                <span className="badge text-[11px] px-2 py-0.5 font-semibold border-destructive/30 bg-destructive/10 text-destructive">
                  Inactive
                </span>
              )}
            </div>
          </div>
        </div>

        {institute && (
          <div className="flex items-center gap-2.5 rounded-xl border bg-muted/40 px-4 py-2.5 text-xs font-medium text-foreground">
            <School size={16} className="text-primary shrink-0" />
            <div>
              <p className="font-bold">{institute.name}</p>
              <p className="text-[10px] text-muted-foreground">Associated Institute</p>
            </div>
          </div>
        )}
      </div>

      {/* Section 1: Profile Information */}
      <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-2 border-b pb-4">
          <User size={20} className="text-primary" />
          <h3 className="text-lg font-bold text-foreground">Personal Information</h3>
        </div>

        <form onSubmit={handleSaveName} className="space-y-4 max-w-md">
          <Field
            label="Full Name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your Name"
            disabled={readOnly || savingName}
            required
          />

          {nameError && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle size={14} /> {nameError}</p>}
          {nameSuccess && <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle size={14} /> {nameSuccess}</p>}

          <button
            type="submit"
            disabled={readOnly || savingName || name.trim() === user.name}
            className="btn text-xs py-2 px-4"
          >
            {savingName ? <Loader2 size={14} className="animate-spin" /> : null}
            Save Name
          </button>
        </form>

        <div className="border-t pt-6 space-y-4 max-w-md">
          <div>
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Email Address</label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full rounded-xl border bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground font-medium outline-none cursor-not-allowed"
              />
              {user.role === 'admin' && (
                <button
                  type="button"
                  disabled={readOnly || !!pendingRequest}
                  onClick={() => setShowEmailModal(true)}
                  className="btn secondary text-xs shrink-0 py-2.5 px-3 whitespace-nowrap"
                  title="Request to change email address"
                >
                  <Mail size={14} /> Request Change
                </button>
              )}
            </div>
            {user.role === 'admin' && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Admins cannot edit their email directly. Click &ldquo;Request Change&rdquo; to submit a request for Owner review.
              </p>
            )}
            {user.role === 'owner' && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                As Owner, your email is your system login address.
              </p>
            )}
          </div>

          {/* Pending Email Change Request Notice */}
          {pendingRequest && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Clock size={14} /> Pending Email Change Request
              </div>
              <p>
                Requested new email: <strong>{pendingRequest.newEmail}</strong>
              </p>
              <p className="text-[11px] opacity-80">
                Your request has been submitted to the Owner. You will receive notification emails once reviewed.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Security & Password */}
      <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-2 border-b pb-4">
          <Lock size={20} className="text-primary" />
          <h3 className="text-lg font-bold text-foreground">Security & Password</h3>
        </div>

        <form onSubmit={handleSavePassword} className="space-y-4 max-w-md">
          <Field
            label="Current Password"
            name="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
            disabled={readOnly || savingPassword}
            required
          />

          <Field
            label="New Password"
            name="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 4 characters"
            disabled={readOnly || savingPassword}
            required
          />

          <Field
            label="Confirm New Password"
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            disabled={readOnly || savingPassword}
            required
          />

          {passwordError && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle size={14} /> {passwordError}</p>}
          {passwordSuccess && <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle size={14} /> {passwordSuccess}</p>}

          <button
            type="submit"
            disabled={readOnly || savingPassword || !currentPassword || !newPassword}
            className="btn text-xs py-2 px-4"
          >
            {savingPassword ? <Loader2 size={14} className="animate-spin" /> : null}
            Change Password
          </button>
        </form>
      </div>

      {/* Email Change Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Mail size={18} className="text-primary" /> Request Email Change
              </h3>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Enter your desired new email address. This request will be sent to the Institute Owner for approval.
              Upon approval, confirmation emails will be sent to both your old and new addresses.
            </p>

            <form onSubmit={handleSubmitEmailRequest} className="space-y-4">
              <Field
                label="Current Email"
                name="currentEmail"
                value={user.email}
                disabled
              />

              <Field
                label="New Email Address"
                name="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="newemail@example.com"
                required
                autoFocus
              />

              {emailError && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle size={14} /> {emailError}</p>}
              {emailSuccess && <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle size={14} /> {emailSuccess}</p>}

              <div className="flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="btn secondary text-xs py-2 px-3"
                  disabled={submittingEmail}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEmail || !newEmail.trim()}
                  className="btn text-xs py-2 px-4"
                >
                  {submittingEmail ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
