'use client'

import { useState, useEffect } from 'react'
import {
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  School,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { ExamCreator, ExamQuestionManager } from './exam-builder'
import { AnswerSheetViewer } from './answer-sheet'
import { Empty, Field, Heading, Stat } from './ui-bits'
import { deleteQuestionImage } from '@/lib/imgbb'
import {
  formatDateTime,
  gradeAttempt,
  totalMarks,
  type AppData,
  type Attempt,
  type Exam,
  type Institute,
  type Question,
  type Room,
  type User as UserType,
} from '@/lib/exam-types'

export type View = 'dashboard' | 'rooms' | 'exams' | 'results' | 'students' | 'people' | 'institutes' | 'settings' | 'admins'

export type AdminOps = {
  addRoom: (name: string, subject: string) => Promise<string | null>
  updateRoom: (id: string, name: string, subject: string) => Promise<string | null>
  deleteRoom: (id: string) => Promise<string | null>
  addExam: (exam: Exam) => Promise<string | null>
  updateExam: (id: string, changes: Partial<Exam>) => Promise<string | null>
  deleteExam: (id: string) => Promise<string | null>
  addUser: (name: string, email: string, password: string, role: 'admin' | 'student') => Promise<string | null>
  updateUser: (
    id: string,
    name: string,
    email: string,
    password?: string,
    status?: 'active' | 'inactive',
  ) => Promise<string | null>
  toggleUserStatus: (id: string, status: 'active' | 'inactive') => Promise<string | null>
  deleteUser: (id: string) => Promise<string | null>
  toggleRoomMember: (studentId: string, roomId: string, joined: boolean) => Promise<string | null>
  resetAttempt: (attemptId: string) => Promise<string | null>
}

export function AdminWorkspace({
  view,
  user,
  data,
  ops,
  readOnly = false,
  onImpersonate,
  activeInstituteId,
  initialRoleFilter,
}: {
  view: View
  user: UserType
  data: AppData
  ops: AdminOps
  readOnly?: boolean
  onImpersonate?: (user: UserType) => void
  activeInstituteId?: string | null
  initialRoleFilter?: 'all' | 'admin' | 'student' | null
}) {
  const currentInstId = activeInstituteId || user.instituteId
  const activeInstitute = data.institutes?.find((inst) => inst.id === currentInstId)

  const rooms = user.role === 'owner'
    ? (currentInstId ? data.rooms.filter((room) => room.instituteId === currentInstId) : data.rooms)
    : (currentInstId
        ? data.rooms.filter((room) => room.instituteId === currentInstId || room.adminId === user.id)
        : data.rooms.filter((room) => room.adminId === user.id))

  const exams = user.role === 'owner'
    ? (currentInstId ? data.exams.filter((exam) => exam.instituteId === currentInstId) : data.exams)
    : data.exams.filter((exam) => rooms.some((room) => exam.roomIds?.includes(room.id)))

  const attempts = data.attempts.filter(
    (attempt) => exams.some((exam) => exam.id === attempt.examId) && attempt.submittedAt,
  )
  const activeAttempts = data.attempts.filter(
    (attempt) => exams.some((exam) => exam.id === attempt.examId) && !attempt.submittedAt,
  )
  const [showRoomForm, setShowRoomForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editingExpiryExamId, setEditingExpiryExamId] = useState<string | null>(null)
  const [expiryEndsAt, setExpiryEndsAt] = useState('')
  const [expiryNever, setExpiryNever] = useState(true)
  const [opError, setOpError] = useState('')
  const [working, setWorking] = useState(false)
  const [examTab, setExamTab] = useState<'all' | 'live' | 'draft' | 'expired'>('all')
  const [expandedSubmissionsExamId, setExpandedSubmissionsExamId] = useState<string | null>(null)
  const [inspectingAttempt, setInspectingAttempt] = useState<{
    exam: Exam
    attempt: Attempt
    studentName: string
  } | null>(null)
  const [resettingAttemptId, setResettingAttemptId] = useState<string | null>(null)

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [selectedSubmissionsExamId, setSelectedSubmissionsExamId] = useState<string | null>(null)
  const [resultsRoomId, setResultsRoomId] = useState<string>('all')
  const [resultsSubject, setResultsSubject] = useState<string>('all')

  // Enhanced Room & Roster Management State
  const [managingRoomId, setManagingRoomId] = useState<string | null>(null)
  const [editingRoom, setEditingRoom] = useState<{ id: string; name: string; subject: string } | null>(null)
  const [rosterTab, setRosterTab] = useState<'enrolled' | 'enroll' | 'quick-add' | 'code'>('enrolled')
  const [rosterSearch, setRosterSearch] = useState('')
  const [enrollSearch, setEnrollSearch] = useState('')
  const [selectedEnrollIds, setSelectedEnrollIds] = useState<string[]>([])
  const [copiedRoomCode, setCopiedRoomCode] = useState<string | null>(null)
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null)
  const [togglingMemberId, setTogglingMemberId] = useState<string | null>(null)
  const [enrollingBatch, setEnrollingBatch] = useState(false)
  const [quickName, setQuickName] = useState('')
  const [quickEmail, setQuickEmail] = useState('')
  const [quickPassword, setQuickPassword] = useState('')
  const [quickShowPassword, setQuickShowPassword] = useState(false)
  const [quickError, setQuickError] = useState('')
  const [quickSuccess, setQuickSuccess] = useState('')

  const handleOp = async (fn: () => Promise<string | null>): Promise<string | null> => {
    setWorking(true)
    setOpError('')
    try {
      const err = await fn()
      if (err) setOpError(err)
      return err
    } catch {
      const err = 'Something went wrong. Please try again.'
      setOpError(err)
      return err
    } finally {
      setWorking(false)
    }
  }

  const addRoom = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const fd = new FormData(form)
    const name = String(fd.get('name') || '').trim()
    const subject = String(fd.get('subject') || '').trim()
    if (!name || !subject) return
    const err = await handleOp(() => ops.addRoom(name, subject))
    if (!err) {
      form.reset()
      setShowRoomForm(false)
    }
  }

  const handleEditRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingRoom || !editingRoom.name.trim() || !editingRoom.subject.trim()) return
    const err = await handleOp(() =>
      ops.updateRoom(editingRoom.id, editingRoom.name.trim(), editingRoom.subject.trim()),
    )
    if (!err) {
      setEditingRoom(null)
    }
  }

  const handleDeleteRoom = async (room: Room) => {
    if (
      !window.confirm(
        `Are you sure you want to delete classroom "${room.name}"? This action cannot be undone and will remove all student enrollments and disassociate exams.`,
      )
    ) {
      return
    }
    setDeletingRoomId(room.id)
    try {
      await ops.deleteRoom(room.id)
      if (managingRoomId === room.id) setManagingRoomId(null)
    } finally {
      setDeletingRoomId(null)
    }
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedRoomCode(code)
    setTimeout(() => setCopiedRoomCode(null), 2500)
  }

  const updateExam = async (examId: string, changes: Partial<Exam>) =>
    handleOp(() => ops.updateExam(examId, changes))

  const setQuestions = (examId: string, questions: Question[]) =>
    updateExam(examId, { questions })

  const handleSaveExpiry = async (examId: string) => {
    await updateExam(examId, {
      neverUnpublish: expiryNever,
      endsAt: expiryNever ? undefined : expiryEndsAt ? new Date(expiryEndsAt).toISOString() : undefined,
    })
    setEditingExpiryExamId(null)
  }

  const handleResetAttempt = async (attempt: Attempt, studentName: string) => {
    if (
      !window.confirm(
        `Are you sure you want to reset the test score for ${studentName}? This will delete their attempt and allow them to re-take the exam.`,
      )
    ) {
      return
    }
    setResettingAttemptId(attempt.id)
    try {
      await ops.resetAttempt(attempt.id)
    } finally {
      setResettingAttemptId(null)
    }
  }

  const generateQuickPassword = () => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000)
    setQuickPassword(`Student@${randomSuffix}`)
    setQuickShowPassword(true)
  }

  const handleQuickAddStudent = async (e: React.FormEvent, roomId: string) => {
    e.preventDefault()
    if (!quickName.trim() || !quickEmail.trim() || !quickPassword.trim()) {
      setQuickError('All fields are required.')
      return
    }
    setWorking(true)
    setQuickError('')
    setQuickSuccess('')
    try {
      const err = await ops.addUser(quickName.trim(), quickEmail.trim().toLowerCase(), quickPassword.trim(), 'student')
      if (err) {
        setQuickError(err)
        return
      }
      setQuickSuccess(`Student ${quickName.trim()} created and enrolled into classroom!`)
      setQuickName('')
      setQuickEmail('')
      setQuickPassword('')
    } catch {
      setQuickError('Failed to create student.')
    } finally {
      setWorking(false)
    }
  }

  const handleToggleMember = async (studentId: string, roomId: string, joined: boolean) => {
    setTogglingMemberId(studentId)
    try {
      await ops.toggleRoomMember(studentId, roomId, joined)
    } finally {
      setTogglingMemberId(null)
    }
  }

  const handleBatchEnroll = async (roomId: string) => {
    if (!selectedEnrollIds.length) return
    setEnrollingBatch(true)
    try {
      for (const sId of selectedEnrollIds) {
        await ops.toggleRoomMember(sId, roomId, true)
      }
      setSelectedEnrollIds([])
    } finally {
      setEnrollingBatch(false)
    }
  }

  if (view === 'rooms') {
    const managingRoom = rooms.find((r) => r.id === managingRoomId)
    const enrolledStudents = managingRoom
      ? data.users.filter((u) => managingRoom.memberIds?.includes(u.id))
      : []
    const availableStudents = managingRoom
      ? data.users.filter(
          (u) =>
            u.role === 'student' &&
            (currentInstId ? u.instituteId === currentInstId : true) &&
            !managingRoom.memberIds?.includes(u.id),
        )
      : []

    const filteredEnrolled = enrolledStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(rosterSearch.toLowerCase()) ||
        s.email.toLowerCase().includes(rosterSearch.toLowerCase()),
    )

    const filteredAvailable = availableStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(enrollSearch.toLowerCase()) ||
        s.email.toLowerCase().includes(enrollSearch.toLowerCase()),
    )

    return (
      <>
        {/* Room Edit Modal */}
        {editingRoom && !readOnly && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Pencil size={18} className="text-primary" /> Edit Classroom
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingRoom(null)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleEditRoomSubmit} className="mt-5 space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">Classroom Name</label>
                  <input
                    type="text"
                    value={editingRoom.name}
                    onChange={(e) => setEditingRoom({ ...editingRoom, name: e.target.value })}
                    required
                    className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">Subject</label>
                  <input
                    type="text"
                    value={editingRoom.subject}
                    onChange={(e) => setEditingRoom({ ...editingRoom, subject: e.target.value })}
                    required
                    className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setEditingRoom(null)}
                    className="btn secondary py-2 px-4 text-xs"
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={working} className="btn py-2 px-5 text-xs font-semibold">
                    {working ? <Loader2 size={14} className="animate-spin" /> : null}
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Classroom Roster & Student Management Modal */}
        {managingRoom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 md:p-6 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="max-h-[92vh] w-full max-w-4xl flex flex-col overflow-hidden rounded-3xl border bg-card shadow-2xl">
              {/* Modal Top Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b bg-muted/20 p-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="badge text-xs font-bold border-primary/30 bg-primary/10 text-primary">
                      {managingRoom.subject}
                    </span>
                    {activeInstitute && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                        <School size={12} /> {activeInstitute.name}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-1.5 text-2xl font-bold text-foreground">
                    {managingRoom.name}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Manage student enrollments, share classroom code, and assign exams.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-1.5 shadow-xs">
                    <span className="text-[11px] uppercase font-bold text-muted-foreground">Code:</span>
                    <span className="font-mono font-bold text-sm text-foreground tracking-wider">{managingRoom.code}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(managingRoom.code)}
                      title="Copy Classroom Code"
                      className="text-muted-foreground hover:text-primary transition-colors ml-1"
                    >
                      {copiedRoomCode === managingRoom.code ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setManagingRoomId(null)}
                    className="rounded-xl border bg-background p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b bg-background px-6 pt-2">
                <button
                  type="button"
                  onClick={() => setRosterTab('enrolled')}
                  className={`border-b-2 px-4 py-3 text-xs font-semibold transition ${
                    rosterTab === 'enrolled'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Users size={14} className="inline mr-1.5" />
                  Enrolled Students ({enrolledStudents.length})
                </button>
                {!readOnly && (
                  <>
                    <button
                      type="button"
                      onClick={() => setRosterTab('enroll')}
                      className={`border-b-2 px-4 py-3 text-xs font-semibold transition ${
                        rosterTab === 'enroll'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <UserPlus size={14} className="inline mr-1.5" />
                      Add Existing Students ({availableStudents.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRosterTab('quick-add')}
                      className={`border-b-2 px-4 py-3 text-xs font-semibold transition ${
                        rosterTab === 'quick-add'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Sparkles size={14} className="inline mr-1.5" />
                      Quick Onboard Student
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setRosterTab('code')}
                  className={`border-b-2 px-4 py-3 text-xs font-semibold transition ${
                    rosterTab === 'code'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <School size={14} className="inline mr-1.5" />
                  Classroom Details & Code
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* TAB 1: ENROLLED STUDENTS */}
                {rosterTab === 'enrolled' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="relative flex-1 min-w-[220px]">
                        <Search size={15} className="absolute left-3.5 top-3 text-muted-foreground" />
                        <input
                          type="search"
                          placeholder="Search enrolled students by name or email…"
                          value={rosterSearch}
                          onChange={(e) => setRosterSearch(e.target.value)}
                          className="w-full rounded-xl border bg-background pl-9 pr-4 py-2 text-xs outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Total {enrolledStudents.length} student{enrolledStudents.length === 1 ? '' : 's'} enrolled
                      </span>
                    </div>

                    {filteredEnrolled.length ? (
                      <div className="divide-y rounded-2xl border bg-background">
                        {filteredEnrolled.map((student) => {
                          const studentAttempts = data.attempts.filter(
                            (a) => a.userId === student.id && exams.some((e) => e.id === a.examId),
                          )
                          const isRemoving = togglingMemberId === student.id
                          return (
                            <div
                              key={student.id}
                              className="flex flex-wrap items-center justify-between gap-3 p-4 text-xs hover:bg-muted/20 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="grid size-9 place-items-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold border border-purple-500/20">
                                  <GraduationCap size={16} />
                                </div>
                                <div>
                                  <p className="font-bold text-sm text-foreground">{student.name}</p>
                                  <p className="text-muted-foreground text-[11px]">{student.email}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="badge text-[11px]">
                                  {studentAttempts.length} test{studentAttempts.length === 1 ? '' : 's'} taken
                                </span>
                                {!readOnly && (
                                  <button
                                    type="button"
                                    disabled={isRemoving}
                                    onClick={() => handleToggleMember(student.id, managingRoom.id, false)}
                                    title={`Remove ${student.name} from this classroom`}
                                    className="btn secondary border-destructive/30 text-destructive hover:bg-destructive/10 py-1 px-2.5 text-[11px] flex items-center gap-1 shadow-2xs"
                                  >
                                    {isRemoving ? <Loader2 size={12} className="animate-spin" /> : <UserMinus size={12} />}
                                    Remove
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-xs text-muted-foreground border rounded-2xl bg-muted/10">
                        {rosterSearch ? 'No matching students found in this classroom.' : 'No students enrolled in this classroom yet.'}
                        {!readOnly && (
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={() => setRosterTab('enroll')}
                              className="btn secondary py-1.5 px-3 text-xs"
                            >
                              + Add Existing Students
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: ADD EXISTING STUDENTS */}
                {rosterTab === 'enroll' && !readOnly && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="relative flex-1 min-w-[220px]">
                        <Search size={15} className="absolute left-3.5 top-3 text-muted-foreground" />
                        <input
                          type="search"
                          placeholder="Search available students in institute…"
                          value={enrollSearch}
                          onChange={(e) => setEnrollSearch(e.target.value)}
                          className="w-full rounded-xl border bg-background pl-9 pr-4 py-2 text-xs outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      {selectedEnrollIds.length > 0 && (
                        <button
                          type="button"
                          disabled={enrollingBatch}
                          onClick={() => handleBatchEnroll(managingRoom.id)}
                          className="btn py-1.5 px-4 text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                        >
                          {enrollingBatch ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                          Enroll Selected ({selectedEnrollIds.length})
                        </button>
                      )}
                    </div>

                    {filteredAvailable.length ? (
                      <div className="divide-y rounded-2xl border bg-background">
                        {filteredAvailable.map((student) => {
                          const isSelected = selectedEnrollIds.includes(student.id)
                          const isEnrolling = togglingMemberId === student.id
                          return (
                            <div
                              key={student.id}
                              className="flex flex-wrap items-center justify-between gap-3 p-4 text-xs hover:bg-muted/20 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedEnrollIds([...selectedEnrollIds, student.id])
                                    } else {
                                      setSelectedEnrollIds(selectedEnrollIds.filter((id) => id !== student.id))
                                    }
                                  }}
                                  className="rounded border-primary/50 text-primary size-4"
                                />
                                <div>
                                  <p className="font-bold text-sm text-foreground">{student.name}</p>
                                  <p className="text-muted-foreground text-[11px]">{student.email}</p>
                                </div>
                              </div>

                              <button
                                type="button"
                                disabled={isEnrolling}
                                onClick={() => handleToggleMember(student.id, managingRoom.id, true)}
                                className="btn secondary hover:bg-primary hover:text-primary-foreground py-1 px-3 text-[11px] flex items-center gap-1 shadow-2xs transition-colors"
                              >
                                {isEnrolling ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                Enroll
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-xs text-muted-foreground border rounded-2xl bg-muted/10">
                        {enrollSearch ? 'No matching available students found.' : 'All students in this institute are already enrolled in this classroom!'}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: QUICK ONBOARD STUDENT */}
                {rosterTab === 'quick-add' && !readOnly && (
                  <div className="max-w-xl mx-auto rounded-2xl border bg-gradient-to-b from-card to-muted/20 p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-foreground">Create & Enroll Student</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Quickly register a new student account in <strong>{activeInstitute?.name || 'this Institute'}</strong> and immediately enroll them in <strong>{managingRoom.name}</strong>.
                    </p>

                    <form onSubmit={(e) => handleQuickAddStudent(e, managingRoom.id)} className="mt-5 space-y-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-foreground">Full Name *</label>
                        <input
                          type="text"
                          placeholder="e.g. Priya Patel"
                          value={quickName}
                          onChange={(e) => setQuickName(e.target.value)}
                          required
                          className="rounded-xl border bg-background px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-foreground">Email Address *</label>
                        <input
                          type="email"
                          placeholder="e.g. priya@institute.com"
                          value={quickEmail}
                          onChange={(e) => setQuickEmail(e.target.value)}
                          required
                          className="rounded-xl border bg-background px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-foreground">Password *</label>
                          <button
                            type="button"
                            onClick={generateQuickPassword}
                            className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                          >
                            <Sparkles size={11} /> Auto-Generate
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type={quickShowPassword ? 'text' : 'password'}
                            placeholder="At least 4 characters"
                            value={quickPassword}
                            onChange={(e) => setQuickPassword(e.target.value)}
                            required
                            minLength={4}
                            className="w-full rounded-xl border bg-background px-4 py-2.5 text-xs pr-10 outline-none focus:ring-2 focus:ring-ring"
                          />
                          <button
                            type="button"
                            onClick={() => setQuickShowPassword(!quickShowPassword)}
                            className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                          >
                            {quickShowPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>

                      {quickError && (
                        <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                          ⚠️ {quickError}
                        </div>
                      )}
                      {quickSuccess && (
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                          ✓ {quickSuccess}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={working}
                        className="btn w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm mt-2"
                      >
                        {working ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
                        Create Account & Enroll in Classroom
                      </button>
                    </form>
                  </div>
                )}

                {/* TAB 4: CLASSROOM DETAILS & CODE */}
                {rosterTab === 'code' && (
                  <div className="max-w-xl mx-auto space-y-5">
                    <div className="rounded-2xl border bg-muted/30 p-6 text-center shadow-xs">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Student Self-Join Code</p>
                      <p className="mt-2 font-mono text-3xl font-bold tracking-[.25em] text-primary">{managingRoom.code}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Students can sign in to their dashboard and enter this code under &ldquo;My classes&rdquo; to enroll instantly.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(managingRoom.code)}
                        className="btn secondary mt-4 py-2 px-4 text-xs flex items-center gap-2 mx-auto"
                      >
                        {copiedRoomCode === managingRoom.code ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                        {copiedRoomCode === managingRoom.code ? 'Copied to Clipboard!' : 'Copy Code'}
                      </button>
                    </div>

                    <div className="rounded-2xl border bg-card p-5 space-y-3">
                      <h4 className="text-sm font-bold text-foreground">Classroom Summary</h4>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-xl border bg-background p-3">
                          <span className="text-muted-foreground block text-[11px]">Subject</span>
                          <span className="font-bold text-sm text-foreground">{managingRoom.subject}</span>
                        </div>
                        <div className="rounded-xl border bg-background p-3">
                          <span className="text-muted-foreground block text-[11px]">Enrolled Students</span>
                          <span className="font-bold text-sm text-foreground">{enrolledStudents.length} Students</span>
                        </div>
                        <div className="rounded-xl border bg-background p-3">
                          <span className="text-muted-foreground block text-[11px]">Assigned Exams</span>
                          <span className="font-bold text-sm text-foreground">
                            {exams.filter((e) => e.roomIds?.includes(managingRoom.id)).length} Exams
                          </span>
                        </div>
                        <div className="rounded-xl border bg-background p-3">
                          <span className="text-muted-foreground block text-[11px]">Institute</span>
                          <span className="font-bold text-sm text-foreground truncate">{activeInstitute?.name || 'Default'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <Heading
          eyebrow={activeInstitute ? `${activeInstitute.name} • Classrooms` : 'Classroom Management'}
          title="Classrooms & Student Rosters"
          action={
            !readOnly ? (
              <button onClick={() => setShowRoomForm(!showRoomForm)} className="btn flex items-center gap-2 shadow-xs">
                {showRoomForm ? <X size={17} /> : <Plus size={17} />}
                {showRoomForm ? 'Cancel' : 'New Classroom'}
              </button>
            ) : undefined
          }
        />

        {opError && (
          <p role="alert" className="mb-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {opError}
          </p>
        )}

        {showRoomForm && !readOnly && (
          <form
            onSubmit={addRoom}
            className="mb-8 grid gap-4 rounded-3xl border border-primary/30 bg-gradient-to-b from-card to-primary/5 p-6 shadow-md md:grid-cols-[1fr_1fr_auto] animate-in fade-in slide-in-from-top-3 duration-200"
          >
            <Field label="Classroom Name" name="name" placeholder="e.g. Physics Cohort B" required />
            <Field label="Subject" name="subject" placeholder="e.g. Physics" required />
            <div className="flex flex-col gap-2">
              <span className="hidden text-sm font-medium opacity-0 md:block">Action</span>
              <button className="btn py-3 px-6 text-xs font-semibold" disabled={working}>
                {working ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Create Classroom
              </button>
            </div>
          </form>
        )}

        {/* Classrooms Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => {
            const roomExams = exams.filter((e) => e.roomIds?.includes(room.id))
            const liveRoomExams = roomExams.filter((e) => e.published)
            const isDeleting = deletingRoomId === room.id
            const isCopied = copiedRoomCode === room.code

            return (
              <article
                key={room.id}
                className="group flex flex-col justify-between rounded-3xl border bg-card p-6 shadow-xs transition-all hover:border-primary/50 hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="badge border-primary/30 bg-primary/10 text-primary font-bold text-xs">
                      {room.subject}
                    </span>

                    {!readOnly && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title={`Edit ${room.name}`}
                          onClick={() => setEditingRoom({ id: room.id, name: room.name, subject: room.subject })}
                          className="grid size-8 place-items-center rounded-xl border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={isDeleting}
                          title={`Delete ${room.name}`}
                          onClick={() => handleDeleteRoom(room)}
                          className="grid size-8 place-items-center rounded-xl border text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-40"
                        >
                          {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    )}
                  </div>

                  <h3 className="mt-3 text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                    {room.name}
                  </h3>

                  {/* Join Code Display */}
                  <div className="mt-4 flex items-center justify-between rounded-2xl border bg-muted/40 p-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Join Code</span>
                      <span className="font-mono text-base font-bold text-foreground tracking-widest">{room.code}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(room.code)}
                      title="Copy Classroom Code"
                      className="btn secondary py-1 px-2.5 text-xs flex items-center gap-1"
                    >
                      {isCopied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                      {isCopied ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  {/* Metrics */}
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border bg-background/80 p-2.5">
                      <span className="text-muted-foreground block text-[11px] flex items-center gap-1">
                        <Users size={12} className="text-purple-500" /> Students
                      </span>
                      <span className="font-bold text-sm text-foreground">{room.memberIds.length} Enrolled</span>
                    </div>

                    <div className="rounded-xl border bg-background/80 p-2.5">
                      <span className="text-muted-foreground block text-[11px] flex items-center gap-1">
                        <BookOpen size={12} className="text-amber-500" /> Exams
                      </span>
                      <span className="font-bold text-sm text-foreground">{roomExams.length} Total ({liveRoomExams.length} Live)</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="mt-6 border-t pt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setManagingRoomId(room.id)
                      setRosterTab('enrolled')
                    }}
                    className="btn flex-1 justify-center py-2 text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                  >
                    <Users size={14} />
                    Manage Students ({room.memberIds.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRoomId(room.id)
                      // In admin-workspace, selecting room ID enables exam view filtered for this room
                    }}
                    title={`View exams for ${room.name}`}
                    className="btn secondary py-2 px-3 text-xs"
                  >
                    Exams
                  </button>
                </div>
              </article>
            )
          })}
        </div>

        {!rooms.length && !showRoomForm && (
          <Empty text="No classrooms created yet. Click 'New Classroom' above to create your first room." />
        )}
      </>
    )
  }

  if (view === 'exams') {
    const selectedRoom = rooms.find((r) => r.id === selectedRoomId)
    const selectedSubmissionsExam = exams.find((e) => e.id === selectedSubmissionsExamId)

    // Answer Sheet Modal
    const answerSheetModal = inspectingAttempt && (
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 md:p-8">
        <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-background p-2 shadow-2xl">
          <AnswerSheetViewer
            exam={inspectingAttempt.exam}
            attempt={inspectingAttempt.attempt}
            studentName={inspectingAttempt.studentName}
            instituteName={activeInstitute?.name}
            onClose={() => setInspectingAttempt(null)}
          />
        </div>
      </div>
    )

    // LEVEL 3: DEDICATED SUBMISSIONS PAGE FOR A SPECIFIC EXAM
    if (selectedSubmissionsExam) {
      const examAttempts = data.attempts
        .filter((a) => a.examId === selectedSubmissionsExam.id)
        .sort((a, b) => {
          const subA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0
          const subB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0
          if (subB !== subA) return subB - subA

          const scoreA = a.score ?? 0
          const scoreB = b.score ?? 0
          return scoreB - scoreA
        })

      return (
        <>
          {answerSheetModal}
          <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <button
              onClick={() => {
                setSelectedSubmissionsExamId(null)
              }}
              className="hover:text-foreground hover:underline"
            >
              Exams
            </button>
            {selectedRoom && (
              <>
                <span>/</span>
                <button
                  onClick={() => setSelectedSubmissionsExamId(null)}
                  className="hover:text-foreground hover:underline"
                >
                  {selectedRoom.name}
                </button>
              </>
            )}
            <span>/</span>
            <span className="font-medium text-foreground">{selectedSubmissionsExam.title} Submissions</span>
          </div>

          <Heading
            eyebrow={`Submissions · ${selectedSubmissionsExam.subject}`}
            title={selectedSubmissionsExam.title}
            action={
              <button
                onClick={() => setSelectedSubmissionsExamId(null)}
                className="btn secondary"
              >
                Back to exams
              </button>
            }
          />

          <div className="mt-6 rounded-2xl border bg-card p-6">
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-lg font-semibold">
                Student Submissions ({examAttempts.length})
              </h2>
              <span className="text-xs text-muted-foreground">
                Ranked by score & faster completion time
              </span>
            </div>

            {examAttempts.length ? (
              <div className="mt-4 flex flex-col gap-3">
                {examAttempts.map((attempt, index) => {
                  const student = data.users.find((u) => u.id === attempt.userId)
                  const studentName = student?.name ?? 'Unknown Student'
                  const isResetting = resettingAttemptId === attempt.id
                  const totalTimeSec = attempt.answers.reduce((sum, ans) => sum + (ans.seconds || 0), 0)
                  const minutes = Math.floor(totalTimeSec / 60)
                  const seconds = totalTimeSec % 60

                  return (
                    <div
                      key={attempt.id}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-muted/30 p-4 text-sm"
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-bold text-muted-foreground">
                          #{index + 1}
                        </span>
                        <div>
                          <p className="font-semibold">{studentName}</p>
                          <p className="text-xs text-muted-foreground">
                            {student?.email ?? '—'} ·{' '}
                            {attempt.submittedAt
                              ? `Submitted ${formatDateTime(attempt.submittedAt)}`
                              : 'In progress'}
                            {totalTimeSec > 0 && ` (${minutes}m ${seconds}s taken)`}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className={`badge py-0.5 px-2 font-mono font-semibold ${
                              (attempt.tabSwitchCount ?? 0) > 0 ? 'bg-destructive/15 text-destructive border-destructive/30 font-bold' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                            }`}>
                              👁️ Tabs: {attempt.tabSwitchCount ?? 0}
                            </span>
                            <span className={`badge py-0.5 px-2 font-mono font-semibold ${
                              (attempt.fullscreenExitCount ?? 0) > 0 ? 'bg-destructive/15 text-destructive border-destructive/30 font-bold' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                            }`}>
                              🖥️ Exits: {attempt.fullscreenExitCount ?? 0}
                            </span>
                            {(attempt.cheatWarningCount ?? 0) > 0 && (
                              <span className="badge py-0.5 px-2 font-mono bg-destructive/15 text-destructive border-destructive/30 font-bold">
                                ⚠️ Blocked: {attempt.cheatWarningCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {attempt.submittedAt ? (
                          <span className="badge font-bold">
                            {gradeAttempt(selectedSubmissionsExam, attempt).score} / {totalMarks(selectedSubmissionsExam)} pts
                          </span>
                        ) : (
                          <span className="badge border-amber-500/40 bg-amber-500/10 text-amber-600">
                            In progress
                          </span>
                        )}
                        {attempt.submittedAt && (
                          <button
                            onClick={() =>
                              setInspectingAttempt({
                                exam: selectedSubmissionsExam,
                                attempt,
                                studentName,
                              })
                            }
                            className="btn secondary py-1.5 text-xs"
                            title="Inspect solutions and answer sheet"
                          >
                            <Eye size={14} /> Solutions
                          </button>
                        )}
                        <button
                          onClick={() => handleResetAttempt(attempt, studentName)}
                          disabled={isResetting}
                          className="btn secondary border-destructive/30 text-destructive hover:bg-destructive/10 py-1.5 text-xs"
                          title="Reset attempt score"
                        >
                          {isResetting ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <RotateCcw size={14} />
                          )}
                          Reset
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No students have submitted solutions for this exam yet.
              </p>
            )}
          </div>
        </>
      )
    }

    // LEVEL 1: ROOM SELECTION LIST (IF NO ROOM IS CLICKED YET)
    if (!selectedRoomId) {
      return (
        <>
          <Heading
            eyebrow="Assessment studio"
            title="Exams by Room"
            action={
              rooms.length ? (
                <button onClick={() => setCreating(!creating)} className="btn">
                  <Plus size={17} /> New exam
                </button>
              ) : undefined
            }
          />
          {!rooms.length && <Empty text="Create a room first — exams belong to a room." />}

          <p className="mb-6 text-sm text-muted-foreground">
            Select a room below to view, manage, and inspect exams and student submissions for that room.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => {
              const roomExams = exams.filter((e) => e.roomIds?.includes(room.id))
              const liveRoomExams = roomExams.filter((e) => e.published)
              return (
                <article
                  key={room.id}
                  onClick={() => setSelectedRoomId(room.id)}
                  className="group cursor-pointer rounded-2xl border bg-card p-6 transition-all hover:border-primary hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="badge">{room.subject}</span>
                      <h3 className="mt-2 text-xl font-bold group-hover:text-primary transition-colors">
                        {room.name}
                      </h3>
                    </div>
                    <span className="badge border-primary/30 bg-primary/10 text-primary">
                      {room.memberIds.length} students
                    </span>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
                    <div>
                      <span className="font-semibold text-foreground">{roomExams.length}</span> Total Exams
                    </div>
                    <div>
                      <span className="font-semibold text-emerald-600">{liveRoomExams.length}</span> Live Exams
                    </div>
                    <span className="font-medium text-primary group-hover:underline">
                      View exams &rarr;
                    </span>
                  </div>
                </article>
              )
            })}
          </div>

          <div className="mt-8 border-t pt-6">
            <button
              onClick={() => setSelectedRoomId('all')}
              className="btn secondary text-xs"
            >
              Show all exams across all rooms ({exams.length})
            </button>
          </div>
        </>
      )
    }

    // LEVEL 2: EXAMS LIST FOR THE SELECTED ROOM
    const filteredExams =
      selectedRoomId === 'all'
        ? exams
        : exams.filter((e) => e.roomIds?.includes(selectedRoomId))

    const now = new Date()
    const liveExams = filteredExams.filter(
      (e) => e.published && (e.neverUnpublish || !e.endsAt || new Date(e.endsAt) > now),
    )
    const draftExams = filteredExams.filter((e) => !e.published)
    const expiredExams = filteredExams.filter(
      (e) => e.published && !e.neverUnpublish && e.endsAt && new Date(e.endsAt) <= now,
    )

    const displayedExams =
      examTab === 'live'
        ? liveExams
        : examTab === 'draft'
          ? draftExams
          : examTab === 'expired'
            ? expiredExams
            : filteredExams

    return (
      <>
        {answerSheetModal}

        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <button
            onClick={() => setSelectedRoomId(null)}
            className="hover:text-foreground hover:underline"
          >
            Rooms
          </button>
          <span>/</span>
          <span className="font-medium text-foreground">
            {selectedRoom ? selectedRoom.name : 'All Rooms'}
          </span>
        </div>

        <Heading
          eyebrow={
            selectedRoom
              ? `${activeInstitute ? activeInstitute.name + ' • ' : ''}${selectedRoom.name} (${selectedRoom.subject})`
              : activeInstitute
                ? `${activeInstitute.name} • Assessment Studio`
                : 'Assessment Studio'
          }
          title={selectedRoom ? `${selectedRoom.name} Exams` : 'All Exams'}
          action={
            rooms.length ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedRoomId(null)}
                  className="btn secondary"
                >
                  Change room
                </button>
                <button onClick={() => setCreating(!creating)} className="btn">
                  <Plus size={17} /> New exam
                </button>
              </div>
            ) : undefined
          }
        />

        <div className="mb-6 flex gap-2 rounded-xl border bg-card p-1">
          <button
            onClick={() => setExamTab('all')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              examTab === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All ({filteredExams.length})
          </button>
          <button
            onClick={() => setExamTab('live')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              examTab === 'live'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Live ({liveExams.length})
          </button>
          <button
            onClick={() => setExamTab('draft')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              examTab === 'draft'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Drafts ({draftExams.length})
          </button>
          <button
            onClick={() => setExamTab('expired')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              examTab === 'expired'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Expired ({expiredExams.length})
          </button>
        </div>

        {opError && (
          <p role="alert" className="mb-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {opError}
          </p>
        )}
        {creating && rooms.length > 0 && (
          <div className="mb-6">
            <ExamCreator
              rooms={rooms}
              onCancel={() => setCreating(false)}
              onCreate={async (exam) => {
                await handleOp(() => ops.addExam(exam))
                setCreating(false)
              }}
            />
          </div>
        )}

        {/* Live Active Test Takers Anti-Cheating Telemetry Panel */}
        {data.attempts.some((a) => !a.submittedAt) && (
          <div className="mb-6 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <h3 className="text-base font-bold text-foreground">
                  🔴 Live Anti-Cheating Test Monitoring ({data.attempts.filter((a) => !a.submittedAt).length} Active Test-Taker{data.attempts.filter((a) => !a.submittedAt).length === 1 ? '' : 's'})
                </h3>
              </div>
              <span className="text-xs text-muted-foreground font-medium">Real-time anti-cheat telemetry ping</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.attempts.filter((a) => !a.submittedAt).map((attempt) => {
                const takerUser = data.users.find((u) => u.id === attempt.userId)
                const takerExam = data.exams.find((e) => e.id === attempt.examId)
                const elapsedMins = Math.max(1, Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 60000))
                const tabSwitches = attempt.tabSwitchCount ?? 0
                const fsExits = attempt.fullscreenExitCount ?? 0
                const warnings = attempt.cheatWarningCount ?? 0

                return (
                  <div key={attempt.id} className="rounded-2xl border bg-card p-4 space-y-3 shadow-xs">
                    <div className="flex items-start justify-between gap-2 border-b pb-2">
                      <div>
                        <p className="font-bold text-sm text-foreground">{takerUser?.name || 'Student'}</p>
                        <p className="text-xs text-muted-foreground">{takerUser?.email}</p>
                      </div>
                      <span className="badge text-[10px] font-bold border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        🟢 IN PROGRESS
                      </span>
                    </div>

                    <div className="text-xs text-muted-foreground space-y-1">
                      <p><strong className="text-foreground">Exam:</strong> {takerExam?.title || 'Unknown Exam'}</p>
                      <p><strong className="text-foreground">Elapsed:</strong> ~{elapsedMins} mins (Started {formatDateTime(attempt.startedAt)})</p>
                    </div>

                    {/* Anti-cheating Telemetry Badges */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t text-[11px]">
                      <span className={`badge py-0.5 px-2 font-mono font-semibold ${
                        tabSwitches > 0 ? 'bg-destructive/15 text-destructive border-destructive/30 font-bold' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                      }`}>
                        👁️ Tabs: {tabSwitches}
                      </span>
                      <span className={`badge py-0.5 px-2 font-mono font-semibold ${
                        fsExits > 0 ? 'bg-destructive/15 text-destructive border-destructive/30 font-bold' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                      }`}>
                        🖥️ Exits: {fsExits}
                      </span>
                      {warnings > 0 && (
                        <span className="badge py-0.5 px-2 font-mono bg-destructive/15 text-destructive border-destructive/30 font-bold">
                          ⚠️ Blocked: {warnings}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="grid gap-4">
          {displayedExams.map((exam) => {
            const activeTakers = data.attempts.filter(
              (a) => a.examId === exam.id && !a.submittedAt,
            ).length
            const examAttempts = data.attempts.filter((a) => a.examId === exam.id)
            const isEditingExpiry = editingExpiryExamId === exam.id

            return (
              <article key={exam.id} className="rounded-2xl border bg-card p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="badge">{exam.published ? 'Published' : 'Draft'}</span>
                      {activeTakers > 0 && (
                        <span className="badge flex items-center gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          🔒 {activeTakers} student{activeTakers === 1 ? '' : 's'} taking test now (Read-Only Locked)
                        </span>
                      )}
                    </div>
                    <h2 className="mt-3 text-xl font-semibold">{exam.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {exam.subject} · {exam.duration} minutes · {totalMarks(exam)} marks ·{' '}
                      {exam.roomIds
                        ?.map((id) => data.rooms.find((room) => room.id === id)?.name)
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar size={13} />
                      {exam.neverUnpublish || !exam.endsAt
                        ? 'Never expires'
                        : `Expires: ${new Date(exam.endsAt).toLocaleString()}`}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setSelectedSubmissionsExamId(exam.id)}
                      className="btn secondary border-primary/40 text-primary hover:bg-primary/10"
                    >
                      <Users size={16} /> View Submissions ({examAttempts.length})
                    </button>
                    {!readOnly && (
                      <>
                        <button
                          disabled={activeTakers > 0}
                          onClick={() => {
                            if (isEditingExpiry) {
                              setEditingExpiryExamId(null)
                            } else {
                              setEditingExpiryExamId(exam.id)
                              setExpiryNever(Boolean(exam.neverUnpublish))
                              setExpiryEndsAt(
                                exam.endsAt
                                  ? new Date(exam.endsAt).toISOString().slice(0, 16)
                                  : '',
                              )
                            }
                          }}
                          title={activeTakers > 0 ? 'Cannot edit expiry while exam is in progress' : 'Edit Expiry / Settings'}
                          className="btn secondary disabled:opacity-40"
                        >
                          <Calendar size={16} /> Expiry settings
                        </button>
                        <button
                          onClick={() =>
                            handleOp(async () => {
                              if (
                                !window.confirm(
                                  `Are you sure you want to ${exam.published ? 'unpublish' : 'publish'} this exam?`,
                                )
                              )
                                return null
                              return ops.updateExam(exam.id, { published: !exam.published })
                            })
                          }
                          disabled={activeTakers > 0 || !exam.questions.length || working}
                          title={
                            activeTakers > 0
                              ? 'Cannot toggle publish status while students are taking the test'
                              : exam.questions.length
                              ? undefined
                              : 'Add a question before publishing'
                          }
                          className="btn secondary disabled:opacity-40"
                        >
                          {exam.published ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          aria-label={`Delete ${exam.title}`}
                          onClick={() =>
                            handleOp(async () => {
                              if (!window.confirm('Are you sure you want to delete this exam?')) return null
                              // Fire-and-forget: delete all ImgBB images for questions in this exam
                              exam.questions.forEach((q) => {
                                if (q.deleteUrl) deleteQuestionImage(q.deleteUrl)
                              })
                              return ops.deleteExam(exam.id)
                            })
                          }
                          disabled={activeTakers > 0 || working}
                          title={activeTakers > 0 ? 'Cannot delete exam while students are taking the test' : `Delete ${exam.title}`}
                          className="grid size-10 place-items-center rounded-xl border text-muted-foreground hover:text-destructive disabled:opacity-40"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {activeTakers > 0 && (
                  <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <Lock size={14} />
                    <span>🔒 Exam is currently being attempted by students. Modifying questions or deleting this exam is disabled until all attempts finish.</span>
                  </div>
                )}

                {isEditingExpiry && (
                  <div className="mt-4 rounded-xl border bg-muted/40 p-4">
                    <p className="mb-3 text-sm font-semibold">Edit Expiry & Unpublish Settings</p>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={expiryNever}
                          onChange={(e) => setExpiryNever(e.target.checked)}
                          className="rounded"
                        />
                        Never unpublish
                      </label>
                      {!expiryNever && (
                        <input
                          type="datetime-local"
                          value={expiryEndsAt}
                          onChange={(e) => setExpiryEndsAt(e.target.value)}
                          className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                        />
                      )}
                      <div className="flex gap-2 sm:ml-auto">
                        <button
                          type="button"
                          onClick={() => setEditingExpiryExamId(null)}
                          className="btn secondary py-1 text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveExpiry(exam.id)}
                          className="btn py-1 text-xs"
                          disabled={working}
                        >
                          Save Expiry
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <ExamQuestionManager
                  exam={exam}
                  onChange={(questions) => setQuestions(exam.id, questions)}
                  readOnly={readOnly || activeTakers > 0}
                />
              </article>
            )
          })}
        </div>
        {!displayedExams.length && rooms.length > 0 && !creating && (
          <Empty text="No exams found in this room or category." />
        )}
      </>
    )
  }

  if (view === 'results') {
    const roomFilteredExams =
      resultsRoomId === 'all'
        ? exams
        : exams.filter((e) => e.roomIds?.includes(resultsRoomId))

    const availableSubjects = Array.from(
      new Set(roomFilteredExams.map((e) => e.subject).filter(Boolean)),
    )

    const filteredExams =
      resultsSubject === 'all'
        ? roomFilteredExams
        : roomFilteredExams.filter((e) => e.subject === resultsSubject)

    const filteredExamIds = new Set(filteredExams.map((e) => e.id))
    const filteredAttempts = attempts.filter((a) => filteredExamIds.has(a.examId))

    const scored = filteredAttempts.map((attempt) => {
      const exam = data.exams.find((item) => item.id === attempt.examId)!
      return { attempt, exam, grade: gradeAttempt(exam, attempt) }
    })
    const average = scored.length
      ? Math.round(scored.reduce((sum, item) => sum + item.grade.score, 0) / scored.length)
      : 0
    return (
      <>
        <Heading
          eyebrow={activeInstitute ? `${activeInstitute.name} • Performance Analytics` : 'Performance Analytics'}
          title="Exam-wise Analytics & Rankings"
        />

        {/* Top Room & Subject Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex flex-1 min-w-[200px] flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Filter by Room
            </label>
            <select
              value={resultsRoomId}
              onChange={(e) => {
                setResultsRoomId(e.target.value)
                setResultsSubject('all')
              }}
              className="rounded-xl border bg-background px-3 py-2 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Rooms ({rooms.length})</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name} ({room.subject})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-1 min-w-[200px] flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Filter by Subject
            </label>
            <select
              value={resultsSubject}
              onChange={(e) => setResultsSubject(e.target.value)}
              className="rounded-xl border bg-background px-3 py-2 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Subjects ({availableSubjects.length})</option>
              {availableSubjects.map((subj) => (
                <option key={subj} value={subj}>
                  {subj}
                </option>
              ))}
            </select>
          </div>

          {(resultsRoomId !== 'all' || resultsSubject !== 'all') && (
            <button
              onClick={() => {
                setResultsRoomId('all')
                setResultsSubject('all')
              }}
              className="btn secondary self-end py-2 text-xs"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Stat label="Average score" value={scored.length ? average : '—'} note="Across filtered attempts" />
          <Stat label="Total Submissions" value={scored.length} note="Completed attempts in selection" />
        </div>

        {filteredExams.length ? (
          <div className="mt-8 flex flex-col gap-6">
            {filteredExams.map((exam) => {
              const examAttempts = attempts.filter((a) => a.examId === exam.id)
              return (
                <section key={exam.id} className="rounded-2xl border bg-card p-6 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-4">
                    <div>
                      <h2 className="text-lg font-semibold">{exam.title}</h2>
                      <p className="text-xs text-muted-foreground">
                        {exam.subject} · {totalMarks(exam)} total marks
                      </p>
                    </div>
                    <span className="badge">
                      {examAttempts.length} submission{examAttempts.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  {examAttempts.length ? (
                    <Leaderboard
                      attempts={examAttempts}
                      data={data}
                      exam={exam}
                    />
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">
                      No submissions recorded yet for this exam.
                    </p>
                  )}
                </section>
              )
            })}
          </div>
        ) : (
          <div className="mt-6">
            <Empty text="No exams or analytics match the selected Room and Subject filters." />
          </div>
        )}
      </>
    )
  }

  if (view === 'students' || view === 'people' || view === 'admins') {
    return (
      <PeopleView
        data={data}
        ops={ops}
        rooms={rooms}
        user={user}
        readOnly={readOnly}
        onImpersonate={onImpersonate}
        activeInstitute={activeInstitute}
        forcedRole={view === 'admins' ? 'admin' : view === 'students' ? 'student' : undefined}
        initialRoleFilter={initialRoleFilter}
      />
    )
  }

  return (
    <>
      <Heading
        eyebrow={activeInstitute ? `${activeInstitute.name} • Admin Overview` : 'Admin Overview'}
        title={`Welcome back, ${user.name}.`}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Active rooms" value={rooms.length} note="Across your organization" />
        <Stat
          label="Published exams"
          value={exams.filter((exam) => exam.published).length}
          note="Visible to joined students"
        />
        <Stat
          label="Students"
          value={rooms.reduce((count, room) => count + room.memberIds.length, 0)}
          note="Room memberships"
        />
        <Stat
          label="Live Takers"
          value={activeAttempts.length}
          note="Currently taking tests"
        />
        <Stat label="Submissions" value={attempts.length} note="Ready for analysis" />
      </div>
      <section className="mt-8 rounded-2xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Recent activity</h2>
        {attempts.length ? (
          <div className="mt-5 flex flex-col gap-4">
            {attempts.map((attempt) => (
              <div
                key={attempt.id}
                className="flex items-center justify-between gap-4 border-b pb-4 last:border-0 last:pb-0"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {data.users.find((item) => item.id === attempt.userId)?.name} submitted a test
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {data.exams.find((item) => item.id === attempt.examId)?.title}
                  </p>
                </div>
                <span className="badge">{attempt.score} pts</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No submissions yet. Share a room code to get started.
          </p>
        )}
      </section>
    </>
  )
}

function Leaderboard({
  attempts,
  data,
  exam,
}: {
  attempts: Attempt[]
  data: AppData
  exam?: Exam
}) {
  const [showAll, setShowAll] = useState(false)

  // Tie-breaker logic:
  // Primary: Score descending (higher marks get higher rank)
  // Secondary: Total time spent ascending (less time consumed = submitted faster = higher rank)
  // Tertiary: SubmittedAt timestamp ascending (earlier submission timestamp = higher rank)
  const sorted = [...attempts].sort((a, b) => {
    const scoreA = a.score ?? 0
    const scoreB = b.score ?? 0
    if (scoreB !== scoreA) return scoreB - scoreA

    const timeA = a.answers.reduce((acc, ans) => acc + (ans.seconds || 0), 0)
    const timeB = b.answers.reduce((acc, ans) => acc + (ans.seconds || 0), 0)
    if (timeA !== timeB) return timeA - timeB

    const subA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0
    const subB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0
    return subA - subB
  })

  const displayedAttempts = showAll ? sorted : sorted.slice(0, 10)

  // Check if score is tied with adjacent attempts for tie-breaker badge display
  const isTiedScore = (idx: number) => {
    const currentScore = sorted[idx]?.score ?? 0
    const prevScore = sorted[idx - 1]?.score
    const nextScore = sorted[idx + 1]?.score
    return (prevScore !== undefined && currentScore === prevScore) || (nextScore !== undefined && currentScore === nextScore)
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground">
        <span>Ranked by marks. Identical scores are tie-broken by fastest completion time.</span>
        <span className="font-medium">Showing {displayedAttempts.length} of {sorted.length} students</span>
      </div>

      <div className="flex flex-col gap-2">
        {displayedAttempts.map((attempt, position) => {
          const student = data.users.find((item) => item.id === attempt.userId)
          const studentName = student?.name ?? 'Unknown Student'
          const totalTimeSec = attempt.answers.reduce((sum, ans) => sum + (ans.seconds || 0), 0)
          const minutes = Math.floor(totalTimeSec / 60)
          const seconds = totalTimeSec % 60
          const rank = position + 1
          const tied = isTiedScore(position)

          const rankBadge =
            rank === 1 ? (
              <span className="flex items-center gap-1.5 rounded-lg border border-amber-400/60 bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300 shadow-sm shrink-0">
                🥇 1st Place
              </span>
            ) : rank === 2 ? (
              <span className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 shrink-0">
                🥈 2nd Place
              </span>
            ) : rank === 3 ? (
              <span className="flex items-center gap-1.5 rounded-lg border border-amber-700/40 bg-amber-800/15 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-400 shrink-0">
                🥉 3rd Place
              </span>
            ) : (
              <span className="flex size-8 items-center justify-center rounded-full bg-muted font-mono text-xs font-bold text-muted-foreground shrink-0">
                #{rank}
              </span>
            )

          return (
            <div
              key={attempt.id}
              className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-3.5 transition-colors ${
                rank === 1
                  ? 'border-amber-500/40 bg-amber-500/10 shadow-sm dark:bg-amber-500/15'
                  : rank === 2
                    ? 'border-slate-300/80 bg-slate-500/5 dark:border-slate-700'
                    : rank === 3
                      ? 'border-amber-800/30 bg-amber-900/10 dark:border-amber-700/40'
                      : 'bg-card'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {rankBadge}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-sm truncate text-foreground">{studentName}</p>
                    {tied && (
                      <span
                        title="Score tied with another student — ranked higher due to faster completion time"
                        className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 border border-amber-500/30"
                      >
                        ⚡ Won by faster completion
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {student?.email ?? '—'}
                    {totalTimeSec > 0 && ` · Time spent: ${minutes}m ${seconds}s`}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span
                      className={`badge py-0.5 px-2 font-mono font-semibold ${
                        (attempt.tabSwitchCount ?? 0) > 0
                          ? 'border-destructive/30 bg-destructive/10 text-destructive font-bold'
                          : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      👁️ Tabs: {attempt.tabSwitchCount ?? 0}
                    </span>
                    <span
                      className={`badge py-0.5 px-2 font-mono font-semibold ${
                        (attempt.fullscreenExitCount ?? 0) > 0
                          ? 'border-destructive/30 bg-destructive/10 text-destructive font-bold'
                          : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      🖥️ Exits: {attempt.fullscreenExitCount ?? 0}
                    </span>
                    {(attempt.cheatWarningCount ?? 0) > 0 && (
                      <span className="badge py-0.5 px-2 font-mono border-destructive/30 bg-destructive/10 text-destructive font-bold">
                        ⚠️ Blocked: {attempt.cheatWarningCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-bold text-sm text-foreground">
                  {attempt.score ?? 0} {exam ? `/ ${totalMarks(exam)}` : ''} pts
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {sorted.length > 10 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-3 text-xs font-semibold text-primary hover:underline self-center"
        >
          {showAll ? 'Show Top 10 Only' : `View All ${sorted.length} Participants`}
        </button>
      )}
    </div>
  )
}

function PeopleView({
  data,
  ops,
  rooms,
  user,
  readOnly = false,
  onImpersonate,
  activeInstitute,
  forcedRole,
  initialRoleFilter,
}: {
  data: AppData
  ops: AdminOps
  rooms: Room[]
  user: UserType
  readOnly?: boolean
  onImpersonate?: (user: UserType) => void
  activeInstitute?: Institute | null
  forcedRole?: 'admin' | 'student'
  initialRoleFilter?: 'all' | 'admin' | 'student' | null
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'student'>(forcedRole || initialRoleFilter || 'all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [showAddUser, setShowAddUser] = useState(false)
  const [selectedRole, setSelectedRole] = useState<'student' | 'admin'>(forcedRole || 'student')
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [newError, setNewError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const generatePassword = () => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000)
    const generated = `Pass@${randomSuffix}`
    setFormPassword(generated)
    setShowPassword(true)
  }

  const handleAddUser = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!formName.trim() || !formEmail.trim() || !formPassword.trim()) {
      setNewError('All fields are required.')
      return
    }

    setWorking(true)
    setNewError('')
    setSuccessMsg('')
    try {
      const err = await ops.addUser(formName.trim(), formEmail.trim().toLowerCase(), formPassword, selectedRole)
      if (err) {
        setNewError(err)
      } else {
        setSuccessMsg(`Successfully onboarded ${formName.trim()} as ${selectedRole}!`)
        setSearchQuery(formEmail.trim())
        setFormName('')
        setFormEmail('')
        setFormPassword('')
        setTimeout(() => {
          setShowAddUser(false)
          setSuccessMsg('')
        }, 1200)
      }
    } catch {
      setNewError('Failed to create user. Please try again.')
    } finally {
      setWorking(false)
    }
  }

  const handleEditUser = async (event: React.FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name')).trim()
    const email = String(form.get('email')).trim()
    const password = String(form.get('password')).trim()
    const status = String(form.get('status')) as 'active' | 'inactive'

    setSavingEdit(true)
    setEditError('')
    try {
      const err = await ops.updateUser(id, name, email, password || undefined, status)
      if (err) {
        setEditError(err)
      } else {
        setEditingUserId(null)
      }
    } catch {
      setEditError('Failed to update user. Please try again.')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDeleteUser = async (targetUser: UserType) => {
    if (
      !window.confirm(
        `Are you sure you want to permanently delete ${targetUser.name} (${targetUser.email})? This action cannot be undone and will remove all their classroom enrollments and test attempts.`,
      )
    ) {
      return
    }
    setDeletingId(targetUser.id)
    try {
      await ops.deleteUser(targetUser.id)
    } finally {
      setDeletingId(null)
    }
  }

  const toggleRoom = async (studentId: string, roomId: string, joined: boolean) => {
    setTogglingId(studentId)
    try {
      await ops.toggleRoomMember(studentId, roomId, joined)
    } finally {
      setTogglingId(null)
    }
  }

  // Filter users by institute, role, and search (exclude logged-in admin's own profile)
  const scopedUsers = data.users.filter((u) => {
    if (u.role === 'owner') return false
    if (user.role === 'admin' && u.id === user.id) return false
    if (activeInstitute && u.instituteId !== activeInstitute.id) return false
    return true
  })

  // State for Owner to manage pending email change requests
  const [pendingRequests, setPendingRequests] = useState<Array<{
    id: string
    userId: string
    userName: string
    userRole: string
    currentEmail: string
    newEmail: string
    status: string
    createdAt: string
  }>>([])
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewMsg, setReviewMsg] = useState('')

  useEffect(() => {
    if (user.role !== 'owner') return
    async function fetchRequests() {
      try {
        const res = await fetch('/api/email-change-requests')
        if (res.ok) {
          const data = await res.json()
          setPendingRequests(data.requests || [])
        }
      } catch {
        // Non-critical
      }
    }
    fetchRequests()
  }, [user.role])

  const handleReviewRequest = async (requestId: string, action: 'approve' | 'reject') => {
    setReviewingId(requestId)
    setReviewMsg('')
    try {
      const res = await fetch(`/api/email-change-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (res.ok) {
        setPendingRequests((prev) => prev.filter((r) => r.id !== requestId))
        setReviewMsg(`Request ${action}d successfully. Notification emails sent.`)
        setTimeout(() => setReviewMsg(''), 3000)
      } else {
        setReviewMsg(data.error || 'Failed to update request.')
      }
    } catch {
      setReviewMsg('Network error.')
    } finally {
      setReviewingId(null)
    }
  }

  const totalAdmins = scopedUsers.filter((u) => u.role === 'admin').length
  const totalStudents = scopedUsers.filter((u) => u.role === 'student').length

  const filteredUsers = scopedUsers.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    const userStatus = u.status ?? 'active'
    if (statusFilter !== 'all' && userStatus !== statusFilter) return false
    return (
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  const pageTitle = forcedRole === 'admin'
    ? (activeInstitute ? `Instructors in ${activeInstitute.name}` : 'Instructors & Admins Directory')
    : forcedRole === 'student'
      ? (activeInstitute ? `Students in ${activeInstitute.name}` : 'Students Directory')
      : (activeInstitute ? `Members in ${activeInstitute.name}` : 'People Directory')

  const pageEyebrow = forcedRole === 'admin'
    ? (activeInstitute ? `${activeInstitute.name} • Instructors & Admins` : 'Instructors & Staff')
    : forcedRole === 'student'
      ? (activeInstitute ? `${activeInstitute.name} • Student Roster` : 'Student Roster')
      : (activeInstitute ? `${activeInstitute.name} • People & Access` : 'People & Access')

  return (
    <>
      <Heading
        eyebrow={pageEyebrow}
        title={pageTitle}
        action={
          !readOnly ? (
            <button
              onClick={() => {
                setShowAddUser(!showAddUser)
                setNewError('')
                setSuccessMsg('')
              }}
              className="btn flex items-center gap-2 shadow-xs hover:shadow-md transition-all"
            >
              {showAddUser ? <X size={17} /> : <UserPlus size={17} />}
              {showAddUser ? 'Close Onboarding' : 'Onboard New Member'}
            </button>
          ) : undefined
        }
      />

      {/* Directory Stats Bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl border bg-card px-3.5 py-2 text-xs font-semibold shadow-xs">
          <Users size={15} className="text-primary" />
          <span>Total Members: <strong>{scopedUsers.length}</strong></span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 px-3.5 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 shadow-xs">
          <ShieldCheck size={15} />
          <span>Instructors / Admins: <strong>{totalAdmins}</strong></span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-purple-500/20 bg-purple-500/5 px-3.5 py-2 text-xs font-semibold text-purple-600 dark:text-purple-400 shadow-xs">
          <GraduationCap size={15} />
          <span>Students: <strong>{totalStudents}</strong></span>
        </div>
        {activeInstitute && (
          <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2 text-xs font-semibold text-primary shadow-xs">
            <School size={15} />
            <span>Institute: <strong>{activeInstitute.name}</strong></span>
          </div>
        )}
      </div>

      {/* Pending Email Change Requests (for Owner) */}
      {user.role === 'owner' && pendingRequests.length > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 pb-3">
            <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <Mail size={16} /> Pending Email Change Requests ({pendingRequests.length})
            </h3>
            {reviewMsg && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{reviewMsg}</span>}
          </div>

          <div className="mt-3 space-y-3">
            {pendingRequests.map((req) => (
              <div key={req.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4 text-xs">
                <div>
                  <p className="font-bold text-foreground">{req.userName} <span className="font-normal text-muted-foreground">({req.userRole})</span></p>
                  <p className="text-muted-foreground mt-0.5">
                    Current: <code className="bg-muted px-1.5 py-0.5 rounded">{req.currentEmail}</code> &rarr; Requested: <code className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-bold">{req.newEmail}</code>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={reviewingId === req.id}
                    onClick={() => handleReviewRequest(req.id, 'approve')}
                    className="btn text-xs py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {reviewingId === req.id ? <Loader2 size={12} className="animate-spin" /> : null} Approve
                  </button>
                  <button
                    type="button"
                    disabled={reviewingId === req.id}
                    onClick={() => handleReviewRequest(req.id, 'reject')}
                    className="btn secondary text-xs py-1.5 px-3 border-destructive/30 text-destructive hover:bg-destructive/10"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modern High-End User Onboarding Panel */}
      {showAddUser && !readOnly && (
        <div className="mb-8 overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-b from-card via-card to-primary/5 p-6 md:p-8 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-5">
            <div>
              <span className="badge bg-primary/15 text-primary border-primary/30 inline-flex items-center gap-1.5 px-3 py-1 font-semibold text-xs">
                <UserPlus size={14} /> Member Onboarding
              </span>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                Onboard New Account
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a student or instructor profile with immediate workspace credentials.
              </p>
            </div>
            {activeInstitute && (
              <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-2.5 text-xs flex items-center gap-2.5">
                <span className="grid size-7 place-items-center rounded-lg bg-primary/20 text-primary">
                  <School size={15} />
                </span>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-bold">Assigned Institute</span>
                  <span className="font-bold text-foreground text-sm">{activeInstitute.name}</span>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleAddUser} className="mt-6 space-y-6">
            {/* Step 1: Role Selector Cards */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-3">
                1. Select Account Role
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Student Option */}
                <div
                  onClick={() => setSelectedRole('student')}
                  className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 ${
                    selectedRole === 'student'
                      ? 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-500/5 shadow-sm'
                      : 'border-border bg-card hover:border-purple-500/40 hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="grid size-10 place-items-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      <GraduationCap size={22} />
                    </div>
                    {selectedRole === 'student' && (
                      <span className="badge bg-purple-600 text-white font-bold text-[11px] px-2 py-0.5 inline-flex items-center gap-1">
                        <Check size={12} /> Selected
                      </span>
                    )}
                  </div>
                  <h4 className="mt-3 text-base font-bold text-foreground">Student / Candidate</h4>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Enrolls in subject classrooms, sits for anti-cheat mock tests, and inspects verified solutions.
                  </p>
                </div>

                {/* Admin Option */}
                <div
                  onClick={() => setSelectedRole('admin')}
                  className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 ${
                    selectedRole === 'admin'
                      ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-500/5 shadow-sm'
                      : 'border-border bg-card hover:border-blue-500/40 hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="grid size-10 place-items-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <ShieldCheck size={22} />
                    </div>
                    {selectedRole === 'admin' && (
                      <span className="badge bg-blue-600 text-white font-bold text-[11px] px-2 py-0.5 inline-flex items-center gap-1">
                        <Check size={12} /> Selected
                      </span>
                    )}
                  </div>
                  <h4 className="mt-3 text-base font-bold text-foreground">Instructor / Admin</h4>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Creates classrooms, authors timed exam papers, views student analytics, and manages roster.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 2: Form Inputs */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-3">
                2. Member Credentials
              </label>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <User size={13} className="text-muted-foreground" /> Full Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    required
                    className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring transition"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Mail size={13} className="text-muted-foreground" /> Email Address <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="e.g. rahul@prayas.test"
                    required
                    className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring transition"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Lock size={13} className="text-muted-foreground" /> Initial Password <span className="text-destructive">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={generatePassword}
                      className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1"
                    >
                      <Sparkles size={11} /> Auto-Generate
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="At least 4 characters"
                      required
                      minLength={4}
                      className="w-full rounded-xl border bg-background px-4 py-3 text-sm pr-10 outline-none focus:ring-2 focus:ring-ring transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Error or Success feedback */}
            {newError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive flex items-center gap-2">
                <span>⚠️ {newError}</span>
              </div>
            )}
            {successMsg && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-2">
                <span>✓ {successMsg}</span>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-5">
              <span className="text-xs text-muted-foreground">
                Account will be created in <strong>{activeInstitute?.name || 'Default Institute'}</strong> and immediately available for login.
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddUser(false)
                    setNewError('')
                    setSuccessMsg('')
                  }}
                  className="btn secondary px-4 py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={working}
                  className="btn px-6 py-2.5 text-xs font-semibold flex items-center gap-2 shadow-sm"
                >
                  {working ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
                  Complete Onboarding
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[240px]">
          <input
            type="search"
            placeholder="Search people by name or email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-ring text-sm"
          />
        </div>
        <div className="w-44">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="w-full rounded-xl border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-ring text-sm"
          >
            <option value="all">All Roles ({scopedUsers.length})</option>
            <option value="admin">Admins ({totalAdmins})</option>
            <option value="student">Students ({totalStudents})</option>
          </select>
        </div>
        <div className="w-44">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full rounded-xl border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-ring text-sm"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Deactivated Only</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 animate-in fade-in duration-300">
        {filteredUsers.map((person) => {
          const isExpanded = expandedUserId === person.id
          const isEditing = editingUserId === person.id
          const isDeleting = deletingId === person.id
          const isUserActive = person.status !== 'inactive'

          return (
            <article
              key={person.id}
              className={`rounded-2xl border p-6 transition-all hover:shadow-sm ${
                isUserActive ? 'bg-card' : 'bg-muted/20 border-destructive/20 opacity-90'
              }`}
            >
              {isEditing ? (
                <form
                  onSubmit={(e) => handleEditUser(e, person.id)}
                  className="grid gap-4 md:grid-cols-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Field
                    label="Full name"
                    name="name"
                    defaultValue={person.name}
                    required
                  />
                  <Field
                    label="Email address"
                    name="email"
                    type="email"
                    defaultValue={person.email}
                    required
                  />
                  <Field
                    label="New Password (optional)"
                    name="password"
                    type="password"
                    placeholder="Keep current password"
                  />
                  <label className="flex flex-col gap-2 text-sm font-medium">
                    Account Status
                    <select
                      name="status"
                      defaultValue={person.status || 'active'}
                      className="rounded-xl border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="active">Active (Can Login)</option>
                      <option value="inactive">Deactivated (Login Blocked)</option>
                    </select>
                  </label>
                  <div className="col-span-full flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingUserId(null)
                        setEditError('')
                      }}
                      className="btn secondary"
                      disabled={savingEdit}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn" disabled={savingEdit}>
                      {savingEdit ? <Loader2 size={16} className="animate-spin" /> : null}
                      Save Changes
                    </button>
                  </div>
                  {editError && (
                    <p role="alert" className="col-span-full text-sm text-destructive">
                      {editError}
                    </p>
                  )}
                </form>
              ) : (
                <>
                  <div
                    className="flex cursor-pointer items-center justify-between gap-4"
                    onClick={() => {
                      if (person.role === 'student') {
                        setExpandedUserId(isExpanded ? null : person.id)
                      }
                    }}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={`grid size-11 place-items-center rounded-2xl font-bold text-sm shadow-xs ${
                        person.role === 'admin'
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                          : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                      }`}>
                        {person.role === 'admin' ? <ShieldCheck size={20} /> : <GraduationCap size={20} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-base font-bold text-foreground">{person.name}</p>
                          <span className={`badge text-xs px-2.5 py-0.5 font-semibold ${
                            person.role === 'admin' 
                              ? 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400' 
                              : 'border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400'
                          }`}>
                            {person.role === 'admin' ? 'Admin / Instructor' : 'Student'}
                          </span>
                          <span className={`badge text-xs px-2 py-0.5 font-bold ${
                            isUserActive
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'border-destructive/30 bg-destructive/10 text-destructive'
                          }`}>
                            {isUserActive ? 'Active' : 'Deactivated'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{person.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {person.role === 'student' && (
                        <span className="badge text-xs">
                          {person.roomIds?.length || 0} room{person.roomIds?.length === 1 ? '' : 's'} joined
                        </span>
                      )}
                      
                      {(() => {
                        const isTakingTest = data.attempts.some((a) => a.userId === person.id && !a.submittedAt)
                        if (isTakingTest) {
                          return (
                            <span className="badge border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold text-xs py-1 px-2.5 flex items-center gap-1">
                              <Lock size={12} /> Taking Test (Impersonation Locked)
                            </span>
                          )
                        }
                        if (user.role === 'owner' && onImpersonate) {
                          return (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                onImpersonate(person)
                              }}
                              title={`Impersonate ${person.name}`}
                              className="btn secondary py-1.5 px-3 text-xs flex items-center gap-1 hover:bg-primary hover:text-primary-foreground transition-colors"
                            >
                              <Eye size={13} /> Impersonate
                            </button>
                          )
                        }
                        return null
                      })()}

                      {!readOnly && (
                        <>
                          <button
                            type="button"
                            title={isUserActive ? `Deactivate ${person.name}` : `Activate ${person.name}`}
                            onClick={async (e) => {
                              e.stopPropagation()
                              const newStatus = isUserActive ? 'inactive' : 'active'
                              await ops.toggleUserStatus(person.id, newStatus)
                            }}
                            className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition ${
                              isUserActive
                                ? 'border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20'
                                : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                            }`}
                          >
                            <Power size={13} />
                            {isUserActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            aria-label={`Edit ${person.name}`}
                            title="Edit details or password"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingUserId(person.id)
                              setEditError('')
                            }}
                            className="grid size-9 place-items-center rounded-xl border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${person.name}`}
                            title="Delete user"
                            disabled={isDeleting}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteUser(person)
                            }}
                            className="grid size-9 place-items-center rounded-xl border text-muted-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                          >
                            {isDeleting ? (
                              <Loader2 size={15} className="animate-spin" />
                            ) : (
                              <Trash2 size={15} />
                            )}
                          </button>
                        </>
                      )}

                      {person.role === 'student' && (
                        <button
                          type="button"
                          aria-label="Toggle details"
                          className="ml-1 text-muted-foreground hover:text-foreground"
                        >
                          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                      )}
                    </div>
                  </div>
                  {isExpanded && person.role === 'student' && (
                    <div
                      className="mt-5 border-t pt-5 animate-in fade-in slide-in-from-top-2 duration-200"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="mb-3 text-sm font-medium">Manage rooms for {person.name}</p>
                      {togglingId === person.id && (
                        <p className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 size={14} className="animate-spin" /> Updating…
                        </p>
                      )}
                      <div className="flex max-h-40 flex-col gap-2 overflow-y-auto pr-2">
                        {rooms.map((room) => {
                          const isJoined = person.roomIds?.includes(room.id)
                          return (
                            <label
                              key={room.id}
                              className="flex cursor-pointer items-center gap-2 rounded-md p-2 text-sm transition-colors hover:bg-muted"
                            >
                              <input
                                type="checkbox"
                                checked={isJoined}
                                disabled={togglingId === person.id || readOnly}
                                onChange={(e) => toggleRoom(person.id, room.id, e.target.checked)}
                                className="rounded border-primary/50"
                              />
                              {room.name}
                            </label>
                          )
                        })}
                        {!rooms.length && (
                          <p className="text-sm text-muted-foreground">
                            No rooms available. Create a room first.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </article>
          )
        })}
        {!filteredUsers.length && (
          <Empty
            text={
              searchQuery
                ? 'No users found matching your search.'
                : 'No users registered yet.'
            }
          />
        )}
      </div>
    </>
  )
}
