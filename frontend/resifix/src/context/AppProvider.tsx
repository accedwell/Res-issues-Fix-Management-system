import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AppContext, type AppState } from './appContext'
import { CATEGORIES, DEFAULT_TABS, STAFF } from '../data/constants'
import { SEED_ISSUES, SEED_NOTIFICATIONS, SEED_SETTINGS, SEED_USERS } from '../data/seed'
import type { Auth, Filters, Issue, Modal, Role, Route, Status } from '../types'

const today = () => new Date().toISOString().slice(0, 10)

const LOGGED_OUT: Auth = { loggedIn: false, role: null, name: null, studentId: null }

export function AppProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>('landing')
  const [authRole, setAuthRole] = useState<Role>('student')
  const [auth, setAuth] = useState<Auth>(LOGGED_OUT)
  const [tabs, setTabs] = useState<Record<Role, string>>({ ...DEFAULT_TABS })
  const [modal, setModal] = useState<Modal | null>(null)
  const [toast, setToast] = useState<{ msg: string; id: number } | null>(null)
  const [issues, setIssues] = useState(SEED_ISSUES)
  const [notifications, setNotifications] = useState(SEED_NOTIFICATIONS)
  const [users, setUsers] = useState(SEED_USERS)
  const [categories, setCategories] = useState(CATEGORIES)
  const [settings, setSettings] = useState(SEED_SETTINGS)
  const [filters, setFilters] = useState<Filters>({ status: 'all', category: 'all', residence: 'all', search: '' })

  const nextRef = useRef(133)
  const nextNotification = useRef(5)
  const nextUser = useRef(1000)

  const showToast = useCallback((msg: string) => setToast({ msg, id: Date.now() }), [])

  const markNotificationsRead = useCallback(
    (studentId: string) =>
      setNotifications((prev) => prev.map((n) => (n.studentId === studentId ? { ...n, read: true } : n))),
    [],
  )

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  const setTab = (tab: string) => {
    if (auth.role) setTabs((prev) => ({ ...prev, [auth.role as Role]: tab }))
  }

  const notify = (studentId: string, message: string) =>
    setNotifications((prev) => [
      { id: 'n-' + nextNotification.current++, studentId, message, date: today(), read: false },
      ...prev,
    ])

  const updateIssue = (id: string, change: (issue: Issue) => Issue) =>
    setIssues((prev) => prev.map((issue) => (issue.id === id ? change(issue) : issue)))

  const withStatus = (issue: Issue, status: Status, note: string): Issue => ({
    ...issue,
    status,
    history: [...issue.history, { status, date: today(), note }],
  })

  const value: AppState = {
    route,
    setRoute,
    authRole,
    setAuthRole,
    auth,
    login: (name, role) => {
      setAuth({ loggedIn: true, role, name, studentId: role === 'student' ? 'stu-1' : null })
      setTabs({ ...DEFAULT_TABS })
    },
    logout: () => {
      setModal(null)
      setAuth(LOGGED_OUT)
      setRoute('landing')
    },
    tabs,
    setTab,
    modal,
    setModal,
    toast,
    issues,
    notifications,
    users,
    categories,
    settings,
    filters,
    setFilters,
    addIssue: (data) => {
      const ref = 'ISS-2026-' + String(nextRef.current++).padStart(5, '0')
      const issue: Issue = {
        id: 'i-' + Date.now(),
        ref,
        ...data,
        status: 'Submitted',
        studentName: auth.name ?? '',
        studentId: auth.studentId ?? '',
        assignedTo: null,
        dateReported: today(),
        history: [{ status: 'Submitted', date: today(), note: 'Report submitted by student.' }],
        feedback: null,
      }
      setIssues((prev) => [issue, ...prev])
      setTab('reports')
      showToast('Report submitted — reference ' + ref)
    },
    assignIssue: (issue, staffId, priority) => {
      const staffName = STAFF.find((s) => s.id === staffId)?.name ?? ''
      updateIssue(issue.id, (i) =>
        withStatus({ ...i, assignedTo: staffId, priority }, 'Assigned', 'Assigned to ' + staffName + ' by residence administrator.'),
      )
      notify(issue.studentId, issue.ref + ' has been assigned to ' + staffName + '.')
      setModal(null)
    },
    updateProgress: (issue, status, note) => {
      const text = note || (status === 'Resolved' ? 'Issue marked as resolved.' : 'Progress updated.')
      updateIssue(issue.id, (i) => withStatus(i, status, text))
      notify(issue.studentId, issue.ref + ' is now ' + status + '.')
      setModal(null)
    },
    confirmResolution: (issue, rating, comment) => {
      updateIssue(issue.id, (i) =>
        withStatus({ ...i, feedback: { rating, comment } }, 'Closed', 'Student confirmed resolution and left feedback.'),
      )
      setModal(null)
    },
    reportNotFixed: (issue, reason) => {
      updateIssue(issue.id, (i) =>
        withStatus({ ...i, reopened: (i.reopened || 0) + 1 }, 'In Progress', 'Student reported the issue is NOT fixed: ' + reason),
      )
      notify(issue.studentId, issue.ref + ' was re-opened and sent back to maintenance.')
      showToast('Issue re-opened — maintenance has been notified.')
      setModal(null)
    },
    addUser: (user) => {
      setUsers((prev) => [...prev, { id: 'u-' + nextUser.current++, ...user }])
      setModal(null)
    },
    removeUser: (userId) => {
      setUsers((prev) => prev.filter((u) => u.id !== userId))
      setModal(null)
    },
    addCategory: (name, icon) => {
      const key =
        name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'cat-' + Date.now()
      // Keep "Other" as the last category.
      setCategories((prev) => [...prev.slice(0, -1), { key, name, icon }, prev[prev.length - 1]])
      setModal(null)
    },
    editCategory: (key, name, icon) => {
      setCategories((prev) => prev.map((c) => (c.key === key ? { ...c, name, icon } : c)))
      setModal(null)
    },
    toggleSetting: (key) => setSettings((prev) => prev.map((s) => (s.key === key ? { ...s, on: !s.on } : s))),
    markNotificationsRead,
    catInfo: (key) => categories.find((c) => c.key === key) || categories[categories.length - 1],
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
