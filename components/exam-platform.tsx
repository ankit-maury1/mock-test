'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  Eye,
  EyeOff,
  Filter,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Plus,
  Power,
  RotateCcw,
  School,
  Settings as SettingsIcon,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import { AdminWorkspace, type AdminOps, type View } from './admin-workspace'
import { StudentWorkspace, type StudentOps } from './student-workspace'
import { TestRunner } from './test-runner'
import { SettingsPage } from './settings-page'
import { ForgotPassword } from './forgot-password'
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
  const [initialRoleFilter, setInitialRoleFilter] = useState<'all' | 'admin' | 'student' | null>(null)
  const [impersonatedUser, setImpersonatedUser] = useState<User | null>(null)
  const isApi = mode === 'api'

  // ─── URL Navigation & History Synchronization ─────────────────────────────

  const syncStateFromUrl = useCallback(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const urlView = params.get('view') as View | null
    const urlInstId = params.get('instituteId')
    const urlExamId = params.get('examId')
    const urlRoleFilter = params.get('roleFilter') as 'all' | 'admin' | 'student' | null

    if (urlView) setView(urlView)
    if (urlInstId !== null) setActiveInstituteId(urlInstId || null)
    if (urlExamId !== null) setActiveExamId(urlExamId || null)
    if (urlRoleFilter !== null) setInitialRoleFilter(urlRoleFilter || null)
  }, [])

  const navigateTo = useCallback(
    (
      newView?: View,
      newInstId?: string | null,
      newExamId?: string | null,
      newRoleFilter?: 'all' | 'admin' | 'student' | null,
      replace = false,
    ) => {
      if (typeof window === 'undefined') return
      const targetView = newView !== undefined ? newView : view
      const targetInstId = newInstId !== undefined ? newInstId : activeInstituteId
      const targetExamId = newExamId !== undefined ? newExamId : activeExamId
      const targetRoleFilter = newRoleFilter !== undefined ? newRoleFilter : initialRoleFilter

      const params = new URLSearchParams()
      if (targetView) params.set('view', targetView)
      if (targetInstId) params.set('instituteId', targetInstId)
      if (targetExamId) params.set('examId', targetExamId)
      if (targetRoleFilter) params.set('roleFilter', targetRoleFilter)

      const searchStr = params.toString()
      const newUrl = searchStr ? `?${searchStr}` : window.location.pathname

      if (replace) {
        window.history.replaceState(null, '', newUrl)
      } else {
        window.history.pushState(null, '', newUrl)
      }

      if (newView !== undefined) setView(newView)
      if (newInstId !== undefined) setActiveInstituteId(newInstId)
      if (newExamId !== undefined) setActiveExamId(newExamId)
      if (newRoleFilter !== undefined) setInitialRoleFilter(newRoleFilter)
    },
    [view, activeInstituteId, activeExamId, initialRoleFilter],
  )

  useEffect(() => {
    syncStateFromUrl()
    const handlePopState = () => syncStateFromUrl()
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [syncStateFromUrl])

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

  // Dynamic Browser Tab Title with Institute Name & personalization
  useEffect(() => {
    if (!ready || !user) {
      document.title = 'Mock Test — Assessment Workspace'
      return
    }

    if (impersonatedUser) {
      const inst = data.institutes?.find((i) => i.id === impersonatedUser.instituteId)
      const instName = inst?.name || 'Institute'
      document.title = `${instName} (${impersonatedUser.name}) — Mock Test Assessment Workspace`
    } else if (user.role === 'owner') {
      if (activeInstituteId) {
        const inst = data.institutes?.find((i) => i.id === activeInstituteId)
        document.title = `${inst?.name || 'Institute Workspace'} — Mock Test Assessment Workspace`
      } else {
        document.title = 'Institutes Console — Mock Test Assessment Workspace'
      }
    } else {
      const inst = data.institutes?.find((i) => i.id === user.instituteId)
      const instName = inst?.name || 'Institute Workspace'
      document.title = `${instName} — Mock Test Assessment Workspace`
    }
  }, [ready, user, impersonatedUser, activeInstituteId, data.institutes])

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

  // Periodically refresh data every 3 seconds so active test attempts, unpublish status, and live anti-cheat telemetry sync in real-time across all windows
  useEffect(() => {
    if (!user) return
    const timer = setInterval(() => {
      refreshData()
    }, 3000)
    return () => clearInterval(timer)
  }, [user, refreshData])

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

  const registerAdminWithInstitute = async (
    name: string,
    email: string,
    password: string,
    instituteName: string,
    instituteDescription?: string,
  ): Promise<string | null> => {
    if (!isApi) {
      const stored = loadData()
      if (stored.users.some((u) => u.email === email)) return 'An account with this email already exists.'
      const instId = crypto.randomUUID()
      const newInst: Institute = {
        id: instId,
        name: instituteName,
        description: instituteDescription,
        status: 'pending',
      }
      const newUser: User = {
        id: crypto.randomUUID(),
        name,
        email,
        password,
        role: 'admin',
        roomIds: [],
        instituteId: instId,
        status: 'active',
      }
      const next = {
        ...stored,
        institutes: [...(stored.institutes || []), newInst],
        users: [...stored.users, newUser],
      }
      saveData(next)
      setUser(newUser)
      saveSession({ userId: newUser.id })
      await refreshData()
      return null
    }
    const { data: res, error } = await apiFetch<{ user: User; institute: Institute }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, instituteName, instituteDescription, role: 'admin' }),
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
        status: 'active',
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

  const toggleInstituteStatus = async (
    id: string,
    status: 'active' | 'inactive' | 'pending' | 'rejected',
    rejectionReason?: string,
  ): Promise<string | null> => {
    const currentInst = data.institutes?.find((i) => i.id === id)
    if (currentInst?.status === 'rejected') {
      return 'Rejected institutes cannot be re-approved or updated.'
    }

    if (!isApi) {
      const stored = loadData()
      const next = {
        ...stored,
        institutes: (stored.institutes || []).map((i) =>
          i.id === id ? { ...i, status, rejectionReason: status === 'rejected' ? rejectionReason : i.rejectionReason } : i
        ),
      }
      saveData(next)
      await refreshData()
      return null
    }
    setData((prev) => ({
      ...prev,
      institutes: (prev.institutes || []).map((i) =>
        i.id === id ? { ...i, status, rejectionReason: status === 'rejected' ? rejectionReason : i.rejectionReason } : i
      ),
    }))
    const { error } = await apiFetch(`/api/institutes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, rejectionReason }),
    })
    if (error) await refreshData()
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
      body: JSON.stringify({ name, subject, instituteId: targetInstId }),
    })
    if (!error) await refreshData()
    return error ?? null
  }

  const updateRoom = async (id: string, name: string, subject: string): Promise<string | null> => {
    if (!isApi) {
      const stored = loadData()
      const next = {
        ...stored,
        rooms: stored.rooms.map((r) => (r.id === id ? { ...r, name, subject } : r)),
      }
      saveData(next)
      await refreshData()
      return null
    }
    const { error } = await apiFetch(`/api/rooms/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name, subject }),
    })
    if (!error) await refreshData()
    return error ?? null
  }

  const deleteRoom = async (id: string): Promise<string | null> => {
    if (!isApi) {
      const stored = loadData()
      const next = {
        ...stored,
        rooms: stored.rooms.filter((r) => r.id !== id),
        users: stored.users.map((u) => ({
          ...u,
          roomIds: u.roomIds.filter((rId) => rId !== id),
        })),
        exams: stored.exams.map((e) => ({
          ...e,
          roomIds: e.roomIds.filter((rId) => rId !== id),
        })),
      }
      saveData(next)
      await refreshData()
      return null
    }
    const { error } = await apiFetch(`/api/rooms/${id}`, { method: 'DELETE' })
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

  const addUser = async (
    name: string,
    email: string,
    password: string,
    role: 'admin' | 'student',
    customInstituteId?: string,
  ): Promise<string | null> => {
    const targetInstId = customInstituteId || activeInstituteId || user!.instituteId
    if (user?.role === 'owner' && !targetInstId) {
      return 'Please select an institute for this user.'
    }
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
    status?: 'active' | 'inactive',
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
              status: status ? status : u.status,
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
      body: JSON.stringify({ name, email, password, status }),
    })
    if (!error) await refreshData()
    return error ?? null
  }

  const toggleUserStatus = async (
    id: string,
    status: 'active' | 'inactive',
  ): Promise<string | null> => {
    if (!isApi) {
      const stored = loadData()
      const next = {
        ...stored,
        users: stored.users.map((u) => (u.id === id ? { ...u, status } : u)),
      }
      saveData(next)
      await refreshData()
      return null
    }
    setData((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === id ? { ...u, status } : u)),
    }))
    const { error } = await apiFetch(`/api/students/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
    if (error) await refreshData()
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
      const targetInstId = activeInstituteId || user?.instituteId || attempt.instituteId
      const attemptToSave = { ...attempt, instituteId: targetInstId || undefined }

      // Optimistically update state so results are immediately visible to the student
      setData((prev) => ({
        ...prev,
        attempts: [...prev.attempts.filter((a) => a.id !== attemptToSave.id), attemptToSave],
      }))

      if (!isApi) {
        const stored = loadData()
        const next = {
          ...stored,
          attempts: [...stored.attempts.filter((a) => a.id !== attemptToSave.id), attemptToSave],
        }
        saveData(next)
        return
      }

      try {
        const { error } = await apiFetch<{ ok: boolean }>('/api/attempts', {
          method: 'POST',
          body: JSON.stringify(attemptToSave),
        })
        if (error) {
          console.error('[saveAttempt] Error:', error)
          if (attemptToSave.submittedAt) {
            throw new Error(error)
          }
          return
        }
        if (attemptToSave.submittedAt) await refreshData()
      } catch (err) {
        console.error('[saveAttempt] Exception:', err)
        if (attemptToSave.submittedAt) {
          throw err
        }
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
        onRegisterAdminWithInstitute={registerAdminWithInstitute}
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
  const currentInstId = userToRender.instituteId || activeInstituteId
  const currentInstitute = data.institutes?.find((i) => i.id === currentInstId)

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
    updateRoom,
    deleteRoom,
    addExam,
    updateExam,
    deleteExam,
    addUser,
    updateUser,
    toggleUserStatus,
    deleteUser,
    toggleRoomMember,
    resetAttempt,
  }
  const studentOps: StudentOps = { joinRoom }

  const handleImpersonate = (person: User) => {
    const isAttempting = data.attempts.some((a) => a.userId === person.id && !a.submittedAt)
    if (isAttempting) {
      setGlobalError(`Cannot impersonate ${person.name} while they are actively taking an exam.`)
      return
    }
    setImpersonatedUser(person)
    navigateTo('dashboard')
  }

  return (
    <Shell
      user={liveUser}
      view={view}
      setView={(v) => navigateTo(v)}
      logout={logout}
      activeInstituteId={activeInstituteId}
      setActiveInstituteId={(id) => navigateTo(undefined, id)}
      data={data}
      isImpersonating={isImpersonating}
      impersonatedUser={impersonatedUser}
      stopImpersonating={() => {
        setImpersonatedUser(null)
        navigateTo('people')
      }}
    >
      {/* Global error banner (set by operations) */}
      {globalError && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive font-semibold">
          <span>{globalError}</span>
          <button onClick={() => setGlobalError(null)} className="ml-4 opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {view === 'settings' ? (
        <SettingsPage
          user={userToRender}
          institute={currentInstitute}
          onUserUpdate={(updated) => {
            setUser((prev) => (prev ? { ...prev, ...updated } : null))
          }}
          readOnly={isImpersonating}
        />
      ) : userToRender.role === 'owner' ? (
        view === 'institutes' ? (
          <InstitutesManager
            data={data}
            onSelect={(id, targetView, targetRoleFilter) => {
              navigateTo(targetView || 'dashboard', id, null, targetRoleFilter || null)
            }}
            onAdd={addInstitute}
            onAddAdmin={addUser}
            onToggleStatus={toggleInstituteStatus}
            onImpersonate={handleImpersonate}
          />
        ) : (
          <AdminWorkspace
            view={view}
            user={userToRender}
            data={data}
            ops={adminOps}
            activeInstituteId={activeInstituteId}
            initialRoleFilter={initialRoleFilter}
            readOnly={isImpersonating}
            onImpersonate={handleImpersonate}
          />
        )
      ) : userToRender.role === 'admin' ? (
        currentInstitute?.status === 'pending' && !isImpersonating ? (
          <PendingApprovalView
            user={userToRender}
            institute={currentInstitute}
            onRefresh={refreshData}
            onLogout={logout}
          />
        ) : currentInstitute?.status === 'rejected' && !isImpersonating ? (
          <RejectedApprovalView
            user={userToRender}
            institute={currentInstitute}
            onLogout={logout}
          />
        ) : (
          <AdminWorkspace
            view={view}
            user={userToRender}
            data={data}
            ops={adminOps}
            activeInstituteId={activeInstituteId}
            initialRoleFilter={initialRoleFilter}
            readOnly={isImpersonating}
            onImpersonate={liveUser.role === 'owner' ? handleImpersonate : undefined}
          />
        )
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

// ─── Status Views for Pending / Rejected Institutes ─────────────────────────

function PendingApprovalView({
  user,
  institute,
  onRefresh,
  onLogout,
}: {
  user: User
  institute?: Institute
  onRefresh: () => void
  onLogout: () => void
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-lg rounded-3xl border bg-card p-8 shadow-xl text-center space-y-6 animate-in fade-in duration-300">
        <div className="grid size-16 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto font-bold border border-amber-500/20">
          <Clock size={32} />
        </div>

        <div>
          <span className="badge border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold text-xs px-3 py-1 uppercase tracking-wider">
            Registration Pending Approval
          </span>
          <h1 className="mt-3 text-2xl font-bold text-foreground">
            Institute Approval Under Review
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Welcome, <strong className="text-foreground">{user.name}</strong>! Your registration request for{' '}
            <strong className="text-foreground">{institute?.name || 'your Institute'}</strong> has been submitted.
          </p>
        </div>

        <div className="rounded-2xl border bg-muted/40 p-4 text-xs text-muted-foreground text-left space-y-2">
          <div className="flex justify-between border-b pb-2">
            <span className="font-semibold text-foreground">Admin Account:</span>
            <span>{user.email}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="font-semibold text-foreground">Institute Name:</span>
            <span>{institute?.name || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-foreground">Notification Sent To:</span>
            <span>Platform Owner Email</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          An email notification has been dispatched to the platform owner to approve your institute. Once approved, you will receive a confirmation email and your workspace will be unlocked automatically.
        </p>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button onClick={onRefresh} className="btn secondary py-2.5 px-5 text-xs font-semibold flex items-center gap-2">
            <RotateCcw size={14} /> Refresh Status
          </button>
          <button onClick={onLogout} className="btn border-destructive/30 text-destructive hover:bg-destructive/10 py-2.5 px-5 text-xs font-semibold flex items-center gap-2">
            <LogOut size={14} /> Log Out
          </button>
        </div>
      </div>
    </div>
  )
}

function RejectedApprovalView({
  user,
  institute,
  onLogout,
}: {
  user: User
  institute?: Institute
  onLogout: () => void
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-destructive/30 bg-card p-8 shadow-xl text-center space-y-6 animate-in fade-in duration-300">
        <div className="grid size-16 place-items-center rounded-2xl bg-destructive/10 text-destructive mx-auto font-bold border border-destructive/20">
          <XCircle size={32} />
        </div>

        <div>
          <span className="badge border-destructive/30 bg-destructive/10 text-destructive font-bold text-xs px-3 py-1 uppercase tracking-wider">
            Registration Not Approved
          </span>
          <h1 className="mt-3 text-2xl font-bold text-foreground">
            Institute Registration Declined
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The registration request for <strong className="text-foreground">{institute?.name || 'your Institute'}</strong> was not approved by the platform owner at this time.
          </p>
        </div>

        <div className="flex justify-center pt-2">
          <button onClick={onLogout} className="btn secondary py-2.5 px-6 text-xs font-semibold flex items-center gap-2">
            <LogOut size={14} /> Log Out
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Auth screen ─────────────────────────────────────────────────────────────

function Auth({
  onLogin,
  onRegisterAdminWithInstitute,
  apiMode,
}: {
  onLogin: (email: string, password: string) => Promise<string | null>
  onRegisterAdminWithInstitute: (
    name: string,
    email: string,
    password: string,
    instituteName: string,
    instituteDescription?: string,
  ) => Promise<string | null>
  apiMode: boolean
}) {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [showForgot, setShowForgot] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (showForgot) {
    return <ForgotPassword onBackToLogin={() => setShowForgot(false)} />
  }

  const submitLogin = async (event: React.FormEvent<HTMLFormElement>) => {
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
      setError('An unexpected error occurred.')
    } finally {
      setSubmitting(false)
    }
  }

  const submitRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const form = new FormData(event.currentTarget)
      const name = String(form.get('name')).trim()
      const email = String(form.get('email')).trim().toLowerCase()
      const password = String(form.get('password'))
      const instituteName = String(form.get('instituteName')).trim()
      const instituteDescription = String(form.get('instituteDescription')).trim()

      if (!name || !email || !password || !instituteName) {
        setError('Full name, email, password, and Institute Name are required.')
        return
      }

      const err = await onRegisterAdminWithInstitute(name, email, password, instituteName, instituteDescription)
      if (err) setError(err)
    } catch {
      setError('Registration failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl border bg-card shadow-xl md:flex-row">
        <section className="flex flex-1 flex-col justify-between bg-primary p-8 text-primary-foreground md:p-12">
          <div>
            <Logo inverse />
            <h1 className="mt-8 text-3xl font-bold tracking-tight">Focus on Learning, not Operations.</h1>
            <p className="mt-3 text-sm opacity-80">
              Manage institutions, rooms, and take tests. Fast anti-cheat exam infrastructure for modern teams.
            </p>
          </div>
          <p className="text-sm opacity-60">Mock Test Assessment Workspace.</p>
        </section>
        <section className="flex flex-1 items-center justify-center p-6 md:p-12">
          <div className="w-full max-w-sm">
            {/* Mode Switcher Tabs */}
            <div className="mb-6 flex rounded-2xl border bg-muted/50 p-1">
              <button
                type="button"
                onClick={() => { setTab('login'); setError(''); }}
                className={`flex-1 rounded-xl py-2 text-xs font-semibold transition ${tab === 'login' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setTab('register'); setError(''); }}
                className={`flex-1 rounded-xl py-2 text-xs font-semibold transition ${tab === 'register' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                Register Institute
              </button>
            </div>

            {tab === 'login' ? (
              <>
                <h2 className="text-2xl font-bold">Welcome back</h2>
                <p className="mt-1 text-sm text-muted-foreground">Sign in to your account</p>
                <form onSubmit={submitLogin} className="mt-6 flex flex-col gap-4">
                  <Field
                    label="Email address"
                    name="email"
                    type="email"
                    placeholder="name@school.edu"
                    required
                  />
                  <div>
                    <Field
                      label="Password"
                      name="password"
                      type="password"
                      placeholder="Password"
                      required
                    />
                    <div className="mt-1.5 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setShowForgot(true)}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  </div>
                  <button className="btn mt-2 py-3 text-xs font-semibold" disabled={submitting}>
                    {submitting ? 'Please wait…' : 'Sign in'}
                  </button>
                  {error && (
                    <p role="alert" className="text-sm text-destructive font-medium">
                      {error}
                    </p>
                  )}
                </form>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-2xl font-bold">Register Institute</h2>
                  <span className="badge text-[10px] border-primary/30 bg-primary/10 text-primary font-bold">ADMIN</span>
                </div>
                <p className="text-xs text-muted-foreground">Onboard your School, College or Institute as Admin.</p>
                <form onSubmit={submitRegister} className="mt-5 flex flex-col gap-3">
                  <Field
                    label="Full Name"
                    name="name"
                    placeholder="Dr. Rajesh Kumar"
                    required
                  />
                  <Field
                    label="Work Email"
                    name="email"
                    type="email"
                    placeholder="admin@academy.edu"
                    required
                  />
                  <Field
                    label="Password"
                    name="password"
                    type="password"
                    placeholder="At least 6 characters"
                    required
                  />
                  <Field
                    label="Institute / College / School Name"
                    name="instituteName"
                    placeholder="Prayas Coaching Academy"
                    required
                  />
                  <Field
                    label="Description / Details (Optional)"
                    name="instituteDescription"
                    placeholder="Main campus coaching institute"
                  />
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-[11px] text-amber-700 dark:text-amber-400">
                    ℹ️ Registrations create an Admin account and send an approval notification to the platform owner.
                  </div>
                  <button className="btn mt-1 py-3 text-xs font-semibold" disabled={submitting}>
                    {submitting ? 'Submitting Request…' : 'Submit Registration →'}
                  </button>
                  {error && (
                    <p role="alert" className="text-sm text-destructive font-medium">
                      {error}
                    </p>
                  )}
                </form>
              </>
            )}

            {/* <div className="mt-6 rounded-2xl bg-muted p-4 text-xs">
              <p className="font-semibold text-foreground">Demo access</p>
              <p className="mt-1.5 text-muted-foreground">Owner: owner@gmail.com / owner123</p>
              <p className="text-muted-foreground">Admin: admin@prayas.test / admin123</p>
              <p className="text-muted-foreground">Student: student@axis.test / student123</p>
              {!apiMode && (
                <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  ⚠ Running in offline mode — add MONGODB_URI to .env for persistence.
                </p>
              )}
            </div> */}
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
  setActiveInstituteId,
  data,
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
  setActiveInstituteId: (id: string | null) => void
  data: AppData
  isImpersonating: boolean
  impersonatedUser: User | null
  stopImpersonating: () => void
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  const currentInstId = impersonatedUser?.instituteId || user.instituteId || activeInstituteId
  const currentInstitute = data.institutes?.find((inst) => inst.id === currentInstId)

  // Decide which navigation links to show based on active user / role
  const links: [View, string, any][] = []

  const userRole = impersonatedUser ? impersonatedUser.role : user.role

  if (userRole === 'owner') {
    links.push(['institutes', 'Institutes', School])
    if (activeInstituteId) {
      links.push(['dashboard', 'Overview', LayoutDashboard])
      links.push(['rooms', 'Rooms', School])
      links.push(['admins', 'Instructors', ShieldCheck])
      links.push(['students', 'Students', Users])
      links.push(['exams', 'Exams', ClipboardList])
      links.push(['results', 'Analytics', Trophy])
      links.push(['settings', 'Settings', SettingsIcon])
    }
  } else if (userRole === 'admin') {
    links.push(['dashboard', 'Overview', LayoutDashboard])
    links.push(['rooms', 'Classrooms', School])
    links.push(['students', 'Students', Users])
    links.push(['exams', 'Exams', ClipboardList])
    links.push(['results', 'Analytics', Trophy])
    links.push(['settings', 'Settings', SettingsIcon])
  } else {
    links.push(['dashboard', 'Home', LayoutDashboard])
    links.push(['rooms', 'My classes', School])
    links.push(['exams', 'Tests', ClipboardList])
    links.push(['results', 'Results', Trophy])
    links.push(['settings', 'Settings', SettingsIcon])
  }

  const activeInstitute = data.institutes?.find((inst) => inst.id === activeInstituteId)

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background px-4 md:hidden">
        <div className="flex items-center gap-2.5 truncate">
          <Logo />
          {currentInstitute && (
            <span className="badge truncate text-xs font-bold max-w-[170px] border-primary/30 bg-primary/10 text-primary">
              {currentInstitute.name}
            </span>
          )}
        </div>
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

        {/* Dynamic Institute Name Badge on Sidebar */}
        {currentInstitute && (
          <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-primary/20 bg-primary/5 px-3 py-2.5 shadow-xs animate-in fade-in duration-200">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
              <School size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-foreground leading-tight">{currentInstitute.name}</p>
              <span className="text-[10px] text-muted-foreground capitalize font-medium">
                {currentInstitute.status === 'inactive' ? 'Disabled Institute' : 'Active Institute'}
              </span>
            </div>
          </div>
        )}

        <nav className="mt-6 flex flex-col gap-2">
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
          <p className="font-semibold text-sm truncate">{impersonatedUser ? impersonatedUser.name : user.name}</p>
          <p className="text-xs capitalize text-muted-foreground">
            {impersonatedUser ? `${impersonatedUser.role} (impersonated)` : `${user.role} workspace`}
          </p>
          {currentInstitute && (
            <p className="mt-1.5 truncate text-[11px] font-medium text-primary flex items-center gap-1">
              <School size={11} className="shrink-0" /> <span className="truncate">{currentInstitute.name}</span>
            </p>
          )}
          <button
            onClick={logout}
            className="mt-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      <main className="md:pl-64">
        {/* Impersonation Banner */}
        {isImpersonating && impersonatedUser && (
          <div className="bg-primary/10 border-b border-primary/20 p-4 sticky top-0 z-40 flex items-center justify-between text-sm animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
              </span>
              <span>
                Logged in as Owner <strong>({user.name})</strong> &bull; Impersonating <strong>{impersonatedUser.name}</strong> ({impersonatedUser.role}) &bull; <span className="font-semibold text-primary">View Only Mode</span>
              </span>
            </div>
            <button
              onClick={stopImpersonating}
              className="btn secondary py-1.5 px-3 text-xs shadow-sm hover:bg-background"
            >
              Exit Impersonation & Revert to {user.name} &rarr;
            </button>
          </div>
        )}

        <div className="mx-auto max-w-7xl p-5 md:p-8">
          {/* Institute Context Bar for Owner */}
          {user.role === 'owner' && activeInstituteId && !isImpersonating && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-5 py-3 text-sm animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                  <School size={17} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Active Institute Context</span>
                    <span className="badge border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold text-[10px]">
                      👁️ Read-Only Mode (Owner Viewing)
                    </span>
                  </div>
                  <p className="font-bold text-foreground leading-tight">{activeInstitute?.name || 'Institute Workspace'}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveInstituteId(null)
                  setView('institutes')
                }}
                className="btn secondary py-1.5 px-3 text-xs flex items-center gap-1.5 hover:bg-background"
              >
                ← Switch / All Institutes
              </button>
            </div>
          )}

          {children}
        </div>
      </main>
    </div>
  )
}

// ─── Status Filter Dropdown Component ──────────────────────────────────────

type StatusFilterType = 'all' | 'pending' | 'active' | 'inactive' | 'rejected'

interface StatusOption {
  id: StatusFilterType
  label: string
  count: number
  icon: React.ReactNode
  badgeClass: string
}

function StatusDropdown({
  value,
  onChange,
  counts,
}: {
  value: StatusFilterType
  onChange: (val: StatusFilterType) => void
  counts: {
    all: number
    pending: number
    active: number
    inactive: number
    rejected: number
  }
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const options: StatusOption[] = [
    {
      id: 'active',
      label: 'Active Only',
      count: counts.active,
      icon: <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />,
      badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    },
    {
      id: 'pending',
      label: 'Pending Approval',
      count: counts.pending,
      icon: <Clock size={15} className="text-amber-500 shrink-0" />,
      badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    },
    {
      id: 'inactive',
      label: 'Disabled Only',
      count: counts.inactive,
      icon: <Power size={15} className="text-destructive shrink-0" />,
      badgeClass: 'bg-destructive/10 text-destructive border-destructive/30',
    },
    {
      id: 'rejected',
      label: 'Rejected Only',
      count: counts.rejected,
      icon: <XCircle size={15} className="text-rose-500 shrink-0" />,
      badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
    },
    {
      id: 'all',
      label: 'All Institutes',
      count: counts.all,
      icon: <Building2 size={15} className="text-primary shrink-0" />,
      badgeClass: 'bg-primary/10 text-primary border-primary/30',
    },
  ]

  const selectedOption = options.find((o) => o.id === value) || options[0]

  return (
    <div className="relative w-full sm:w-72" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cx(
          'flex w-full items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-xs transition-all hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring',
          isOpen && 'border-primary ring-2 ring-primary/20 shadow-md'
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {selectedOption.icon}
          <span className="truncate">{selectedOption.label}</span>
          <span className={cx('ml-auto rounded-full border px-2 py-0.5 text-xs font-bold shrink-0', selectedOption.badgeClass)}>
            {selectedOption.count}
          </span>
        </div>
        <ChevronDown
          size={16}
          className={cx('shrink-0 opacity-60 transition-transform duration-200', isOpen && 'rotate-180 opacity-100 text-primary')}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute right-0 top-full z-50 mt-2 w-full min-w-[270px] overflow-hidden rounded-2xl border bg-card/95 p-1.5 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Filter by Status
          </div>
          {options.map((option) => {
            const isSelected = option.id === value
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.id)
                  setIsOpen(false)
                }}
                className={cx(
                  'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                  isSelected
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-foreground hover:bg-accent/60'
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {option.icon}
                  <span className="truncate">{option.label}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cx('rounded-full border px-2 py-0.5 text-xs font-bold', option.badgeClass)}>
                    {option.count}
                  </span>
                  {isSelected && <Check size={15} className="text-primary shrink-0" />}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Institutes Manager Component ──────────────────────────────────────────

function InstitutesManager({
  data,
  onSelect,
  onAdd,
  onAddAdmin,
  onToggleStatus,
  onImpersonate,
}: {
  data: AppData
  onSelect: (id: string, targetView?: View, targetRoleFilter?: 'all' | 'admin' | 'student') => void
  onAdd: (name: string, description?: string) => Promise<string | null>
  onAddAdmin: (name: string, email: string, password: string, role: 'admin' | 'student', instituteId?: string) => Promise<string | null>
  onToggleStatus: (id: string, status: 'active' | 'inactive' | 'pending' | 'rejected', rejectionReason?: string) => Promise<string | null>
  onImpersonate: (user: User) => void
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active' | 'inactive' | 'rejected'>('active')
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  const [togglingInstId, setTogglingInstId] = useState<string | null>(null)
  const [rejectModalInst, setRejectModalInst] = useState<Institute | null>(null)
  const [rejectReasonText, setRejectReasonText] = useState('')
  const [rejectingError, setRejectingError] = useState('')

  // Add Admin modal state
  const [addAdminInst, setAddAdminInst] = useState<Institute | null>(null)
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminError, setAdminError] = useState('')
  const [adminSuccess, setAdminSuccess] = useState('')
  const [addingAdmin, setAddingAdmin] = useState(false)
  const [showAdminPassword, setShowAdminPassword] = useState(false)

  const generateAdminPassword = () => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000)
    setAdminPassword(`Admin@${randomSuffix}`)
    setShowAdminPassword(true)
  }

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

  const handleSetStatus = async (inst: Institute, newStatus: 'active' | 'inactive' | 'pending' | 'rejected', rejectionReason?: string) => {
    setTogglingInstId(inst.id)
    try {
      await onToggleStatus(inst.id, newStatus, rejectionReason)
    } finally {
      setTogglingInstId(null)
    }
  }

  const pendingCount = (data.institutes || []).filter((i) => i.status === 'pending').length
  const totalActive = (data.institutes || []).filter((i) => i.status === 'active' || (!i.status && i.status !== 'inactive')).length
  const totalDisabled = (data.institutes || []).filter((i) => i.status === 'inactive').length
  const totalRejected = (data.institutes || []).filter((i) => i.status === 'rejected').length

  const list = (data.institutes || []).filter((inst) => {
    const matchesSearch = inst.name.toLowerCase().includes(search.toLowerCase())
    const instStatus = inst.status ?? 'active'
    if (statusFilter !== 'all' && instStatus !== statusFilter) return false
    return matchesSearch
  })

  return (
    <div className="space-y-6">
      <Heading
        eyebrow="Console"
        title="Coaching Institutes & Onboarding"
        action={
          <button onClick={() => setShowAdd(!showAdd)} className="btn">
            <Plus size={17} /> Add Institute
          </button>
        }
      />

      {pendingCount > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-400 font-semibold animate-pulse">
          <div className="flex items-center gap-2">
            <Clock size={16} />
            <span>⚠️ You have {pendingCount} new Institute registration request{pendingCount === 1 ? '' : 's'} waiting for approval!</span>
          </div>
          <button
            onClick={() => setStatusFilter('pending')}
            className="btn py-1 px-3 text-[11px] bg-amber-600 text-white hover:bg-amber-700"
          >
            Review Pending ({pendingCount})
          </button>
        </div>
      )}

      {showAdd && (
        <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl border bg-card p-6 md:grid-cols-3 animate-in fade-in slide-in-from-top-3 duration-200 shadow-md">
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

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex-1 min-w-[240px]">
          <input
            type="search"
            placeholder="Search institutes by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-ring text-sm"
          />
        </div>
        <StatusDropdown
          value={statusFilter}
          onChange={(val) => setStatusFilter(val)}
          counts={{
            all: (data.institutes || []).length,
            pending: pendingCount,
            active: totalActive,
            inactive: totalDisabled,
            rejected: totalRejected,
          }}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((inst) => {
          const status = inst.status ?? 'active'
          const isPending = status === 'pending'
          const isActive = status === 'active'
          const isRejected = status === 'rejected'
          const isToggling = togglingInstId === inst.id

          return (
            <article
              key={inst.id}
              className={`group flex flex-col justify-between rounded-3xl border p-6 transition-all hover:shadow-md ${isPending
                ? 'border-amber-500/40 bg-amber-500/5 shadow-xs'
                : isActive
                  ? 'bg-card hover:border-primary/50'
                  : 'bg-muted/30 border-destructive/30 opacity-90'
                }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`badge text-xs px-2.5 py-0.5 font-bold ${isPending
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                      : isActive
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'border-destructive/30 bg-destructive/10 text-destructive'
                      }`}>
                      {isPending ? 'Pending Approval' : isActive ? 'Active' : isRejected ? 'Rejected' : 'Disabled'}
                    </span>
                  </div>

                  {!isPending && !isRejected && (
                    <button
                      type="button"
                      title={isActive ? `Disable ${inst.name}` : `Activate ${inst.name}`}
                      disabled={isToggling}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSetStatus(inst, isActive ? 'inactive' : 'active')
                      }}
                      className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold transition ${isActive
                        ? 'border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                        }`}
                    >
                      {isToggling ? <Loader2 size={12} className="animate-spin" /> : <Power size={12} />}
                      {isActive ? 'Disable' : 'Activate'}
                    </button>
                  )}
                </div>

                <h3 className="mt-3 text-xl font-bold group-hover:text-primary transition-colors text-foreground">
                  {inst.name}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {inst.description || 'No description provided.'}
                </p>

                {/* Pending Approval Controls */}
                {isPending && (
                  <div className="mt-4 rounded-2xl border border-amber-500/20 bg-card p-4 space-y-3">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <Clock size={14} /> New Admin Registration Request
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isToggling}
                        onClick={() => handleSetStatus(inst, 'active')}
                        className="btn flex-1 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-1"
                      >
                        {isToggling ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={isToggling}
                        onClick={() => {
                          setRejectModalInst(inst)
                          setRejectReasonText('')
                          setRejectingError('')
                        }}
                        className="btn secondary border-destructive/30 text-destructive hover:bg-destructive/10 py-1.5 text-xs flex-1 flex items-center justify-center gap-1"
                      >
                        {isToggling ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                        Reject
                      </button>
                    </div>
                  </div>
                )}

                {/* Rejected Status Display */}
                {isRejected && (
                  <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/5 p-3.5 space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 text-destructive font-semibold">
                      <XCircle size={14} /> Registration Permanently Rejected
                    </div>
                    {inst.rejectionReason ? (
                      <p className="text-muted-foreground text-[11px] leading-relaxed">
                        <strong>Reason:</strong> {inst.rejectionReason}
                      </p>
                    ) : (
                      <p className="text-muted-foreground text-[11px]">
                        This registration request was rejected by the platform owner.
                      </p>
                    )}
                  </div>
                )}

                {/* Disabled Banner */}
                {status === 'inactive' && (
                  <div className="mt-3 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-center gap-2">
                    <span>🔒 Disabled: Member logins for this institute are blocked.</span>
                  </div>
                )}
              </div>

              {/* Enter full workspace button & Add Admin */}
              <div className="mt-6 border-t pt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelect(inst.id, 'dashboard')}
                  className="btn flex-1 justify-center text-xs py-2.5"
                >
                  Enter Workspace &rarr;
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddAdminInst(inst)
                    setAdminName('')
                    setAdminEmail('')
                    setAdminPassword('')
                    setAdminError('')
                    setAdminSuccess('')
                  }}
                  className="btn secondary text-xs py-2.5 px-3 flex items-center gap-1.5 shrink-0"
                  title={`Add Admin to ${inst.name}`}
                >
                  <UserPlus size={14} /> Add Admin
                </button>
              </div>
            </article>
          )
        })}
      </div>
      {!list.length && (
        <Empty text={search ? 'No institutes found matching search.' : 'No institutes created yet.'} />
      )}

      {/* Add Admin Modal */}
      {addAdminInst && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="grid size-8 place-items-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Add Admin / Instructor</h3>
                  <p className="text-xs text-muted-foreground">{addAdminInst.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddAdminInst(null)}
                className="rounded-full p-1 text-muted-foreground hover:bg-accent"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!adminName.trim() || !adminEmail.trim() || !adminPassword.trim()) {
                  setAdminError('All fields are required.')
                  return
                }
                setAddingAdmin(true)
                setAdminError('')
                setAdminSuccess('')
                try {
                  const err = await onAddAdmin(
                    adminName.trim(),
                    adminEmail.trim().toLowerCase(),
                    adminPassword.trim(),
                    'admin',
                    addAdminInst.id
                  )
                  if (err) {
                    setAdminError(err)
                  } else {
                    setAdminSuccess(`Successfully onboarded ${adminName.trim()} as Admin for ${addAdminInst.name}!`)
                    setTimeout(() => {
                      setAddAdminInst(null)
                    }, 1200)
                  }
                } catch {
                  setAdminError('Failed to add admin. Please try again.')
                } finally {
                  setAddingAdmin(false)
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Full Name *</label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="e.g. Dr. Vikram Sharma"
                  required
                  className="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Email Address *</label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="e.g. vikram@prayas.test"
                  required
                  className="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">Initial Password *</label>
                  <button
                    type="button"
                    onClick={generateAdminPassword}
                    className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1"
                  >
                    <Sparkles size={11} /> Auto-Generate
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="At least 4 characters"
                    required
                    minLength={4}
                    className="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm pr-10 outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    {showAdminPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {adminError && (
                <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-2.5">
                  ⚠️ {adminError}
                </p>
              )}
              {adminSuccess && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 font-semibold">
                  ✓ {adminSuccess}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAddAdminInst(null)}
                  className="btn secondary flex-1 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingAdmin}
                  className="btn flex-1 text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  {addingAdmin ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                  Add Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectModalInst && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">Reject Institute Registration</h3>
              <button
                type="button"
                onClick={() => {
                  setRejectModalInst(null)
                  setRejectReasonText('')
                  setRejectingError('')
                }}
                className="rounded-full p-1 text-muted-foreground hover:bg-accent"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Rejecting <strong>{rejectModalInst.name}</strong> is permanent and cannot be undone. Please enter a reason to inform the requester.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Reason for Rejection (sent via email)</label>
              <textarea
                rows={3}
                value={rejectReasonText}
                onChange={(e) => setRejectReasonText(e.target.value)}
                placeholder="e.g. Invalid organization details or duplicate request."
                className="w-full rounded-xl border bg-background p-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {rejectingError && <p className="text-xs text-destructive">{rejectingError}</p>}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRejectModalInst(null)
                  setRejectReasonText('')
                  setRejectingError('')
                }}
                className="btn secondary flex-1 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={togglingInstId === rejectModalInst.id}
                onClick={async () => {
                  if (!rejectReasonText.trim()) {
                    setRejectingError('Please enter a rejection reason.')
                    return
                  }
                  setTogglingInstId(rejectModalInst.id)
                  try {
                    const err = await onToggleStatus(rejectModalInst.id, 'rejected', rejectReasonText.trim())
                    if (err) {
                      setRejectingError(err)
                    } else {
                      setRejectModalInst(null)
                      setRejectReasonText('')
                      setRejectingError('')
                    }
                  } finally {
                    setTogglingInstId(null)
                  }
                }}
                className="btn bg-destructive hover:bg-destructive/90 text-destructive-foreground flex-1 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                {togglingInstId === rejectModalInst.id ? <Loader2 size={14} className="animate-spin" /> : null}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
