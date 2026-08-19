'use client'

import { useCallback, useEffect, useState } from 'react'
import { ClipboardList, LayoutDashboard, LogOut, Menu, School, Trophy, Users, X, Eye, Plus, Loader2 } from 'lucide-react'
import { AdminWorkspace, type AdminOps, type View } from './admin-workspace'
import { StudentWorkspace, type StudentOps } from './student-workspace'
import { TestRunner } from './test-runner'
import { Field, Logo, cx, Empty, Heading } from './ui-bits'
import { loadData, loadSession, saveData, saveSession, seedData } from '@/lib/exam-store'
import type { AppData, Attempt, Exam, User, Institute } from '@/lib/exam-types'

// ─── API helper ──────────────────────────────────────────────────────────────

async function apiFetch<T = unknown>(
  url: string,
  opts?: RequestInit,
): Promise<{ data?: T; error?: string; status: number }> {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...(opts?.headers ?? {}) },
      ...opts,
    })
    const json = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok) return { error: (json.error as string) ?? `Request failed (${res.status})`, status: res.status }
    return { data: json as T, status: res.status }
  } catch {
    return { error: 'Network error. Please check your connection.', status: 0 }
  }
}

// ─── Main platform ───────────────────────────────────────────────────────────

export function ExamPlatform() {
  const [data, setData] = useState<AppData>(seedData)
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [view, setView] = useState<View>('dashboard')
  const [activeExamId, setActiveExamId] = useState<string | null>(null)
  // 'api' = connected to MongoDB, 'local' = localStorage fallback
  const [mode, setMode] = useState<'api' | 'local'>('local')
  const [globalError, setGlobalError] = useState<string | null>(null)

  const [activeInstituteId, setActiveInstituteId] = useState<string | null>(null)
  const [impersonatedUser, setImpersonatedUser] = useState<User | null>(null)

  const isApi = mode === 'api'

  // ─── Data refresh ─────────────────────────────────────────────────────

  const refreshData = useCallback(async () => {
    if (mode === 'api') {
      const url = activeInstituteId ? `/api/data?instituteId=${activeInstituteId}` : '/api/data'
      const { data: appData } = await apiFetch<AppData>(url)
      if (appData) setData(appData)
    } else {
      const stored = loadData()
      if (activeInstituteId) {
        // Filter local state based on activeInstituteId
        const filtered: AppData = {
          users: stored.users.filter((u) => u.instituteId === activeInstituteId || u.role === 'owner'),
          rooms: stored.rooms.filter((r) => r.instituteId === activeInstituteId),
          exams: stored.exams.filter((e) => e.instituteId === activeInstituteId),
          attempts: stored.attempts.filter((a) => a.instituteId === activeInstituteId),
          institutes: stored.institutes || [],
        }
        setData(filtered)
      } else {
        setData(stored)
      }
    }
  }, [mode, activeInstituteId])

  // Automatically refresh data on view switch (when visiting any tab/page)
  useEffect(() => {
    if (ready && user) {
      refreshData()
    }
  }, [view, user?.id, ready, refreshData, activeInstituteId])

  // Automatically refresh data on window focus and tab visibility change
  useEffect(() => {
    if (!ready || !user) return
    const handleRefresh = () => refreshData()
    window.addEventListener('focus', handleRefresh)
    document.addEventListener('visibilitychange', handleRefresh)
    return () => {
      window.removeEventListener('focus', handleRefresh)
      document.removeEventListener('visibilitychange', handleRefresh)
    }
  }, [ready, user, refreshData])

  // Background polling every 10 seconds to keep live data fresh
  useEffect(() => {
    if (!ready || !user) return
    const interval = setInterval(() => {
      refreshData()
    }, 10000)
    return () => clearInterval(interval)
  }, [ready, user, refreshData])

  // ─── Initialization: detect API availability, restore session ─────────

  useEffect(() => {
    async function init() {
      try {
        const { data: meData, status } = await apiFetch<{ user: User | null }>('/api/auth/me')

        if (status === 503 || status === 500 || status === 0) {
          // MongoDB not configured — fall back to localStorage
          const stored = loadData()
          setData(stored)
          const session = loadSession()
          const localUser = session
            ? stored.users.find((u) => u.id === session.userId) ?? null
            : null
          setUser(localUser)
          setMode('local')
          if (localUser?.role === 'owner') {
            setView('institutes')
          }
          return
        }

        // API is reachable
        setMode('api')
        const sessionUser = meData?.user ?? null
        setUser(sessionUser)

        if (sessionUser) {
          if (sessionUser.role === 'owner') {
            setView('institutes')
          }
          const { data: appData } = await apiFetch<AppData>('/api/data')
          if (appData) setData(appData)
        }
      } catch {
        // Full network failure — fall back to localStorage
        const stored = loadData()
        setData(stored)
        const session = loadSession()
        const localUser = session ? stored.users.find((u) => u.id === session.userId) ?? null : null
        setUser(localUser)
        setMode('local')
        if (localUser?.role === 'owner') {
          setView('institutes')
        }
      } finally {
        setReady(true)
      }
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Auth ─────────────────────────────────────────────────────────────

  const login = async (email: string, password: string): Promise<string | null> => {
    if (!isApi) {
      const found = data.users.find((u) => u.email === email && u.password === password)
      if (!found) return 'Email or password is incorrect.'
      setUser(found)
      saveSession({ userId: found.id })
      if (found.role === 'owner') {
        setView('institutes')
      }
      return null
    }
    const { data: res, error } = await apiFetch<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    if (error) return error
    setUser(res!.user)
    if (res!.user.role === 'owner') {
      setView('institutes')
    }
    await refreshData()
    return null
  }

  const register = async (name: string, email: string, password: string): Promise<string | null> => {
    // Disabled in UI, but kept here for fallback logic if needed
    if (!isApi) {
      if (data.users.some((u) => u.email === email)) return 'An account already exists.'
      const created: User = {
        id: crypto.randomUUID(),
        name,
        email,
        password,
        role: 'student',
        roomIds: [],
        instituteId: 'inst-1',
      }
      const next = { ...data, users: [...data.users, created] }
      setData(next)
      saveData(next)
      setUser(created)
      saveSession({ userId: created.id })
      return null
    }
    const { data: res, error } = await apiFetch<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    })
    if (error) return error
    setUser(res!.user)
    await refreshData()
    return null
  }

  const logout = async () => {
    if (isApi) {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } else {
      saveSession(null)
    }
    setUser(null)
    setImpersonatedUser(null)
    setActiveInstituteId(null)
    setView('dashboard')
    setActiveExamId(null)
  }

  // ─── Owner operation: add coaching institute ──────────────────────────

  const addInstitute = async (name: string, description?: string): Promise<string | null> => {
    if (!isApi) {
      const stored = loadData()
      const newInst: Institute = {
        id: crypto.randomUUID(),
        name,
        description,
      }
      const next = {
        ...stored,
        institutes: [...(stored.institutes || []), newInst],
      }
      saveData(next)
      await refreshData()
      return null
    }
    const { error } = await apiFetch('/api/institutes', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    })
    if (!error) await refreshData()
    return error ?? null
  }

  // ─── Admin/Owner operations ───────────────────────────────────────────

  const addRoom = async (name: string, subject: string): Promise<string | null> => {
    const targetInstId = activeInstituteId || user!.instituteId
    if (!isApi) {
      const stored = loadData()
      const room = {
        id: crypto.randomUUID(),
        name,
        subject,
        code: Math.random().toString(36).slice(2, 8).toUpperCase(),
        adminId: user!.id,
        memberIds: [] as string[],
        instituteId: targetInstId || undefined,
      }
      const next = {
        ...stored,
        rooms: [...stored.rooms, room],
        users: stored.users.map((u) =>
          u.id === user!.id ? { ...u, roomIds: [...u.roomIds, room.id] } : u,
        ),
      }
      saveData(next)
      await refreshData()
      return null
    }
    const { error } = await apiFetch('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({ name, subject }),
    })
    if (!error) await refreshData()
    return error ?? null
  }

  const addExam = async (exam: Exam): Promise<string | null> => {
    const targetInstId = activeInstituteId || user!.instituteId
    const examToCreate = { ...exam, instituteId: targetInstId || undefined }
    if (!isApi) {
      const stored = loadData()
      const next = { ...stored, exams: [...stored.exams, examToCreate] }
      saveData(next)
      await refreshData()
      return null
    }
    const { error } = await apiFetch('/api/exams', {
      method: 'POST',
      body: JSON.stringify(examToCreate),
    })
    if (!error) await refreshData()
    return error ?? null
  }

  const updateExam = useCallback(
    async (id: string, changes: Partial<Exam>): Promise<string | null> => {
      if (!isApi) {
        const stored = loadData()
        const next = {
          ...stored,
          exams: stored.exams.map((e) => (e.id === id ? { ...e, ...changes } : e)),
        }
        saveData(next)
        await refreshData()
        return null
      }
      // Optimistic update for snappy publish/unpublish toggle
      setData((prev) => ({
        ...prev,
        exams: prev.exams.map((e) => (e.id === id ? { ...e, ...changes } : e)),
      }))
      const { error } = await apiFetch(`/api/exams/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(changes),
      })
      if (error) await refreshData() // Rollback optimistic update on failure
      return error ?? null
    },
    [isApi, refreshData],
  )

  const deleteExam = async (id: string): Promise<string | null> => {
    if (!isApi) {
      const stored = loadData()
      const next = {
        ...stored,
        exams: stored.exams.filter((e) => e.id !== id),
        attempts: stored.attempts.filter((a) => a.examId !== id),
      }
      saveData(next)
      await refreshData()
      return null
    }
    const { error } = await apiFetch(`/api/exams/${id}`, { method: 'DELETE' })
    if (!error) await refreshData()
    return error ?? null
  }

  const addUser = async (name: string, email: string, password: string, role: 'admin' | 'student'): Promise<string | null> => {
    const targetInstId = activeInstituteId || user!.instituteId
    if (!isApi) {
      const stored = loadData()
      if (stored.users.some((u) => u.email === email))
        return 'A user with this email already exists.'
      const created: User = {
        id: crypto.randomUUID(),
        name,
        email,
        password,
        role,
        roomIds: [],
        instituteId: targetInstId || undefined,
      }
      const next = { ...stored, users: [...stored.users, created] }
      saveData(next)
      await refreshData()
      return null
    }
    const { error } = await apiFetch('/api/students', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role, instituteId: targetInstId }),
    })
    if (!error) await refreshData()
    return error ?? null
  }

  const updateUser = async (
    id: string,
    name: string,
    email: string,
    password?: string,
  ): Promise<string | null> => {
    if (!isApi) {
      const stored = loadData()
      if (stored.users.some((u) => u.email === email && u.id !== id))
        return 'A user with this email already exists.'
      const next = {
        ...stored,
        users: stored.users.map((u) =>
          u.id === id
            ? {
              ...u,
              name,
              email,
              password: password ? password : u.password,
            }
            : u,
        ),
      }
      saveData(next)
      await refreshData()
      return null
    }
    const { error } = await apiFetch(`/api/students/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name, email, password }),
    })
    if (!error) await refreshData()
    return error ?? null
  }

  const deleteUser = async (id: string): Promise<string | null> => {
    if (!isApi) {
      const stored = loadData()
      const next = {
        ...stored,
        users: stored.users.filter((u) => u.id !== id),
        rooms: stored.rooms.map((r) => ({
          ...r,
          memberIds: r.memberIds.filter((mId) => mId !== id),
        })),
        attempts: stored.attempts.filter((a) => a.userId !== id),
      }
      saveData(next)
      await refreshData()
      return null
    }
    const { error } = await apiFetch(`/api/students/${id}`, { method: 'DELETE' })
    if (!error) await refreshData()
    return error ?? null
  }

  const toggleRoomMember = async (
    studentId: string,
    roomId: string,
    joined: boolean,
  ): Promise<string | null> => {
    if (!isApi) {
      const stored = loadData()
      const next = {
        ...stored,
        users: stored.users.map((u) =>
          u.id === studentId
            ? {
              ...u,
              roomIds: joined
                ? [...new Set([...u.roomIds, roomId])]
                : u.roomIds.filter((id) => id !== roomId),
            }
            : u,
        ),
        rooms: stored.rooms.map((r) =>
          r.id === roomId
            ? {
              ...r,
              memberIds: joined
                ? [...new Set([...r.memberIds, studentId])]
                : r.memberIds.filter((id) => id !== studentId),
            }
            : r,
        ),
      }
      saveData(next)
      await refreshData()
      return null
    }
    // Optimistic update for instant checkbox feedback
    setData((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === studentId
          ? {
            ...u,
            roomIds: joined
              ? [...new Set([...u.roomIds, roomId])]
              : u.roomIds.filter((id) => id !== roomId),
          }
          : u,
      ),
      rooms: prev.rooms.map((r) =>
        r.id === roomId
          ? {
            ...r,
            memberIds: joined
              ? [...new Set([...r.memberIds, studentId])]
              : r.memberIds.filter((id) => id !== studentId),
          }
          : r,
      ),
    }))
    const { error } = await apiFetch(`/api/rooms/${roomId}/members`, {
      method: 'PATCH',
      body: JSON.stringify({ studentId, joined }),
    })
    if (error) await refreshData()
    return error ?? null
  }

  // ─── Student operations ───────────────────────────────────────────────

  const joinRoom = async (code: string): Promise<string | null> => {
    if (!isApi) {
      const stored = loadData()
      const room = stored.rooms.find((r) => r.code === code)
      if (!room) return 'No room matches that code.'
      if (user && user.roomIds.includes(room.id)) return 'You already joined this room.'
      const next = {
        ...stored,
        rooms: stored.rooms.map((r) =>
          r.id === room.id
            ? { ...r, memberIds: [...new Set([...r.memberIds, user!.id])] }
            : r,
        ),
        users: stored.users.map((u) =>
          u.id === user!.id ? { ...u, roomIds: [...new Set([...u.roomIds, room.id])] } : u,
        ),
      }
      saveData(next)
      await refreshData()
      return null
    }
    const { error } = await apiFetch('/api/rooms/join', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
    if (!error) await refreshData()
    return error ?? null
  }

  // ─── Attempt persistence ──────────────────────────────────────────────

  const saveAttempt = useCallback(
    async (attempt: Attempt): Promise<void> => {
      const targetInstId = activeInstituteId || user!.instituteId
      const attemptToSave = { ...attempt, instituteId: targetInstId || undefined }
      if (!isApi) {
        const stored = loadData()
        const next = {
          ...stored,
          attempts: [...stored.attempts.filter((a) => a.id !== attemptToSave.id), attemptToSave],
        }
        setData(next)
        saveData(next)
        return
      }
      try {
        await apiFetch('/api/attempts', { method: 'POST', body: JSON.stringify(attemptToSave) })
        // Refresh data after final submission so results appear immediately
        if (attemptToSave.submittedAt) await refreshData()
      } catch {
        // Autosave failure is non-critical; submission errors are caught in TestRunner
      }
    },
    [isApi, refreshData, activeInstituteId, user],
  )

  // ─── Render ────────────────────────────────────────────────────────────

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center">
        <div className="font-mono text-sm text-muted-foreground">Preparing workspace…</div>
      </main>
    )
  }

  if (!user) {
    return (
      <Auth
        onLogin={login}
        onRegister={register}
        apiMode={isApi}
      />
    )
  }

  const activeExam = data.exams.find((e) => e.id === activeExamId) ?? null
  // Use live user object from data so room joins update immediately
  const liveUser = data.users.find((u) => u.id === user.id) ?? user

  // Handle Impersonation mapping
  const userToRender = impersonatedUser || liveUser
  const isImpersonating = !!impersonatedUser

  if (activeExam) {
    return (
      <TestRunner
        exam={activeExam}
        user={userToRender}
        data={data}
        onSave={saveAttempt}
        close={() => setActiveExamId(null)}
      />
    )
  }

  const resetAttempt = async (attemptId: string): Promise<string | null> => {
    if (!isApi) {
      const stored = loadData()
      const next = {
        ...stored,
        attempts: stored.attempts.filter((a) => a.id !== attemptId),
      }
      setData(next)
      saveData(next)
      return null
    }
    const { error } = await apiFetch(`/api/attempts/${attemptId}`, { method: 'DELETE' })
    if (!error) await refreshData()
    return error ?? null
  }

  const adminOps: AdminOps = {
    addRoom,
    addExam,
    updateExam,
    deleteExam,
    addUser,
    updateUser,
    deleteUser,
    toggleRoomMember,
    resetAttempt,
  }
  const studentOps: StudentOps = { joinRoom }

  return (
    <Shell
      user={liveUser}
      view={view}
      setView={setView}
      logout={logout}
      activeInstituteId={activeInstituteId}
      isImpersonating={isImpersonating}
      impersonatedUser={impersonatedUser}
      stopImpersonating={() => {
        setImpersonatedUser(null)
        setView('people')
      }}
    >
      {/* Global error banner (set by operations) */}
      {globalError && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{globalError}</span>
          <button onClick={() => setGlobalError(null)} className="ml-4 opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {userToRender.role === 'owner' ? (
        view === 'institutes' ? (
          <InstitutesManager
            data={data}
            onSelect={(id) => {
              setActiveInstituteId(id)
              setView('dashboard')
            }}
            onAdd={addInstitute}
          />
        ) : (
          <AdminWorkspace
            view={view}
            user={userToRender}
            data={data}
            ops={adminOps}
            readOnly={false}
            onImpersonate={(person) => {
              setImpersonatedUser(person)
              setView('dashboard')
            }}
          />
        )
      ) : userToRender.role === 'admin' ? (
        <AdminWorkspace
          view={view}
          user={userToRender}
          data={data}
          ops={adminOps}
          readOnly={isImpersonating}
          onImpersonate={liveUser.role === 'owner' ? (person) => {
            setImpersonatedUser(person)
            setView('dashboard')
          } : undefined}
        />
      ) : (
        <StudentWorkspace
          view={view}
          user={userToRender}
          data={data}
          ops={studentOps}
          start={(exam) => setActiveExamId(exam.id)}
          readOnly={isImpersonating}
        />
      )}
    </Shell>
  )
}

// ─── Auth screen ─────────────────────────────────────────────────────────────

function Auth({
  onLogin,
  apiMode,
}: {
  onLogin: (email: string, password: string) => Promise<string | null>
  onRegister: (name: string, email: string, password: string) => Promise<string | null>
  apiMode: boolean
}) {
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const form = new FormData(event.currentTarget)
      const email = String(form.get('email')).trim().toLowerCase()
      const password = String(form.get('password'))

      const err = await onLogin(email, password)
      if (err) setError(err)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-3xl border bg-card shadow-2xl">
        <section className="hidden w-1/2 flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
          <Logo inverse />
          <div>
            <p className="mb-6 font-mono text-xs uppercase tracking-[.25em] opacity-70">
              Assessment infrastructure
            </p>
            <h1 className="font-sans text-5xl font-semibold leading-tight text-balance">
              Clarity for every test. Momentum for every learner.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed opacity-75">
              Manage institutions, rooms, and take tests. Fast anti-cheat exam infrastructure for modern teams.
            </p>
          </div>
          <p className="text-sm opacity-60">Prayas Coaching Assessment Workspace.</p>
        </section>
        <section className="flex flex-1 items-center justify-center p-6 md:p-12">
          <div className="w-full max-w-sm">
            <div className="mb-10 lg:hidden">
              <Logo />
            </div>
            <p className="font-mono text-xs uppercase tracking-[.2em] text-primary">
              Welcome back
            </p>
            <h2 className="mt-3 text-3xl font-semibold">
              Sign in to Workspace
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Please enter your credentials below to log in. Self-registration is disabled.
            </p>
            <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
              <Field label="Email" name="email" type="email" placeholder="you@school.edu" required />
              <Field
                label="Password"
                name="password"
                type="password"
                placeholder="Password"
                required
              />
              <button className="btn mt-2 py-3" disabled={submitting}>
                {submitting ? 'Please wait…' : 'Sign in'}
              </button>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </form>
            <div className="mt-8 rounded-xl bg-muted p-4 text-sm">
              <p className="font-medium">Demo access</p>
              <p className="mt-2 text-muted-foreground">Owner: owner@prayas.test / owner123</p>
              <p className="text-muted-foreground">Admin: ankit.maury168@gmail.com / Ankit123</p>
              <p className="text-muted-foreground">Student: student@axis.test / student123</p>
              {!apiMode && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  ⚠ Running in offline mode — add MONGODB_URI to .env for persistence.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

// ─── Shell / navigation ───────────────────────────────────────────────────────

function Shell({
  user,
  view,
  setView,
  logout,
  activeInstituteId,
  isImpersonating,
  impersonatedUser,
  stopImpersonating,
  children,
}: {
  user: User
  view: View
  setView: (view: View) => void
  logout: () => void
  activeInstituteId: string | null
  isImpersonating: boolean
  impersonatedUser: User | null
  stopImpersonating: () => void
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  
  // Decide which navigation links to show based on active user / role
  const links: [View, string, any][] = []
  
  const userRole = impersonatedUser ? impersonatedUser.role : user.role

  if (userRole === 'owner') {
    links.push(['institutes', 'Institutes', School])
    if (activeInstituteId) {
      links.push(['dashboard', 'Overview', LayoutDashboard])
      links.push(['rooms', 'Rooms', School])
      links.push(['people', 'People', Users])
      links.push(['exams', 'Exams', ClipboardList])
      links.push(['results', 'Analytics', Trophy])
    }
  } else if (userRole === 'admin') {
    links.push(['dashboard', 'Overview', LayoutDashboard])
    links.push(['rooms', 'Rooms', School])
    links.push(['people', 'People', Users])
    links.push(['exams', 'Exams', ClipboardList])
    links.push(['results', 'Analytics', Trophy])
  } else {
    links.push(['dashboard', 'Home', LayoutDashboard])
    links.push(['rooms', 'My classes', School])
    links.push(['exams', 'Tests', ClipboardList])
    links.push(['results', 'Results', Trophy])
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background px-4 md:hidden">
        <Logo />
        <button aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(!open)}>
          <Menu />
        </button>
      </header>
      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r bg-background p-5 transition-transform md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between">
          <Logo />
          <button
            aria-label="Close navigation"
            className="md:hidden"
            onClick={() => setOpen(false)}
          >
            <X />
          </button>
        </div>
        <nav className="mt-10 flex flex-col gap-2">
          {links.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => {
                setView(id)
                setOpen(false)
              }}
              aria-current={view === id ? 'page' : undefined}
              className={cx(
                'flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition',
                view === id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t pt-5">
          <p className="font-medium">{impersonatedUser ? impersonatedUser.name : user.name}</p>
          <p className="text-xs capitalize text-muted-foreground">
            {impersonatedUser ? `${impersonatedUser.role} (impersonated)` : `${user.role} workspace`}
          </p>
          <button
            onClick={logout}
            className="mt-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      <main className="md:pl-64">
        {isImpersonating && impersonatedUser && (
          <div className="bg-primary/10 border-b border-primary/20 p-4 sticky top-0 z-40 flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
              </span>
              <span>
                Impersonating <strong>{impersonatedUser.name}</strong> ({impersonatedUser.role}) &bull; <span className="font-semibold text-primary">View Only Mode</span>
              </span>
            </div>
            <button
              onClick={stopImpersonating}
              className="btn secondary py-1.5 px-3 text-xs"
            >
              Stop Impersonating
            </button>
          </div>
        )}
        <div className="mx-auto max-w-7xl p-5 md:p-8">{children}</div>
      </main>
    </div>
  )
}

// ─── Institutes Manager Component ──────────────────────────────────────────

function InstitutesManager({
  data,
  onSelect,
  onAdd,
}: {
  data: AppData
  onSelect: (id: string) => void
  onAdd: (name: string, description?: string) => Promise<string | null>
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setWorking(true)
    setError('')
    try {
      const err = await onAdd(name.trim(), desc.trim())
      if (err) setError(err)
      else {
        setName('')
        setDesc('')
        setShowAdd(false)
      }
    } catch {
      setError('Something went wrong.')
    } finally {
      setWorking(false)
    }
  }

  const list = (data.institutes || []).filter((inst) =>
    inst.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <Heading
        eyebrow="Console"
        title="Coaching Institutes"
        action={
          <button onClick={() => setShowAdd(!showAdd)} className="btn">
            <Plus size={17} /> Add Institute
          </button>
        }
      />

      {showAdd && (
        <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl border bg-card p-6 md:grid-cols-3 animate-in fade-in slide-in-from-top-3 duration-200">
          <Field label="Institute Name" name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Prayas Academy" required />
          <Field label="Description" name="description" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Main road center" />
          <div className="flex flex-col gap-2">
            <span className="hidden text-sm font-medium opacity-0 md:block">Action</span>
            <button className="btn" disabled={working}>
              {working ? <Loader2 size={16} className="animate-spin" /> : null}
              Create Institute
            </button>
          </div>
          {error && <p className="col-span-full text-sm text-destructive">{error}</p>}
        </form>
      )}

      <div className="max-w-md">
        <input
          type="search"
          placeholder="Search institutes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((inst) => (
          <article
            key={inst.id}
            onClick={() => onSelect(inst.id)}
            className="group cursor-pointer rounded-2xl border bg-card p-6 transition-all hover:border-primary hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="badge">Active</span>
                <h3 className="mt-3 text-xl font-bold group-hover:text-primary transition-colors">
                  {inst.name}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {inst.description || 'No description provided.'}
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
              <span className="font-medium text-primary group-hover:underline">
                Enter Workspace &rarr;
              </span>
            </div>
          </article>
        ))}
      </div>
      {!list.length && (
        <Empty text={search ? 'No institutes found matching search.' : 'No institutes created yet.'} />
      )}
    </div>
  )
}
