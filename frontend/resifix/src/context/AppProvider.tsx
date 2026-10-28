import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AppContext, type AppState } from './appContext'
import {
  apiAddCategory, apiAddUser, apiEditUser, apiAssignIssue, apiReceiveIssue, apiConfirmResolution, apiCreateIssue, apiEditCategory, apiMe,
  apiReadAllNotifications, apiReadNotification, apiRemoveCategory, apiRemoveUser, apiReportNotFixed, apiEditIssue, apiCancelIssue, apiSetSetting,
  apiUpdateProgress, clearToken, connectLiveUpdates, fetchCategories, fetchIssues, fetchNotifications, fetchSettings,
  fetchStaff, fetchUsers, getToken, type ApiUser, type Topic,
} from '../api'
import { CATEGORIES, DEFAULT_FILTERS, DEFAULT_TABS, ROLE_NAMES } from '../data/constants'
import { isForUser } from '../utils'
import type { AppNotification, Auth, Category, Filters, Issue, Modal, Role, Route, Setting, Staff, User } from '../types'

const LOGGED_OUT: Auth = { loggedIn: false, role: null, name: null, userId: null, studentId: null }

const ALL_TOPICS: Topic[] = ['issues', 'notifications', 'users', 'staff', 'categories', 'settings']
const ISSUE_TOPICS: Topic[] = ['issues', 'notifications', 'staff']

// Which data each role is allowed to load from the server.
const TOPICS_FOR_ROLE: Record<Role, Topic[]> = {
  student: ['issues', 'notifications', 'categories'],
  maintenance: ['issues', 'notifications', 'categories'],
  admin: ['issues', 'notifications', 'categories', 'staff'],
  sysadmin: ['issues', 'notifications', 'categories', 'staff', 'users', 'settings'],
}

// The user list shows one "details" column: room for students, job for maintenance staff.
function toUserRow(user: ApiUser): User {
  const extra =
    user.role === 'student'
      ? [user.block, user.room && 'Room ' + user.room].filter(Boolean).join(' · ')
      : user.role === 'maintenance'
        ? (user.specialization ?? '')
        : ''
  return {
    id: user.id, name: user.name, role: ROLE_NAMES[user.role], email: user.email, extra: extra || '—',
    kind: user.role, block: user.block, room: user.room, specialization: user.specialization,
  }
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong. Please try again.')

export function AppProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>('landing')
  const [auth, setAuth] = useState<Auth>(LOGGED_OUT)
  const [restoring, setRestoring] = useState(() => !!getToken())
  const [ready, setReady] = useState(false)
  const [tabs, setTabs] = useState<Record<Role, string>>({ ...DEFAULT_TABS })
  const [modal, setModal] = useState<Modal | null>(null)
  const [toast, setToast] = useState<{ msg: string; id: number } | null>(null)
  const [issues, setIssues] = useState<Issue[]>([])
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [categories, setCategories] = useState<Category[]>(CATEGORIES)
  const [settings, setSettings] = useState<Setting[]>([])
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)

  // The live-update handler runs outside React renders, so it reads the current role from here.
  const roleRef = useRef<Role | null>(null)

  const showToast = useCallback((msg: string) => setToast({ msg, id: Date.now() }), [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  const endSession = useCallback(() => {
    clearToken()
    roleRef.current = null
    setModal(null)
    setAuth(LOGGED_OUT)
    setIssues([])
    setNotifications([])
    setUsers([])
    setStaff([])
    setSettings([])
    setFilters(DEFAULT_FILTERS)
    setRoute('landing')
  }, [])

  // Reloads the given kinds of data from the server (only those this role may see).
  const refresh = useCallback(
    async (topics: Topic[]) => {
      const role = roleRef.current
      if (!role) return
      const wanted = topics.filter((t) => TOPICS_FOR_ROLE[role].includes(t))
      const loaders: Record<Topic, () => Promise<void>> = {
        issues: async () => setIssues(await fetchIssues()),
        notifications: async () => setNotifications(await fetchNotifications()),
        categories: async () => setCategories(await fetchCategories()),
        staff: async () => setStaff(await fetchStaff()),
        users: async () => setUsers((await fetchUsers()).map(toUserRow)),
        settings: async () => setSettings(await fetchSettings()),
      }
      const results = await Promise.allSettled(wanted.map((t) => loaders[t]()))
      const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
      if (!failed) return
      // An expired or removed account can't load anything, so send the user back to log in.
      if (/log in/i.test(errorMessage(failed.reason))) {
        endSession()
        showToast('Your session has ended. Please log in again.')
      } else {
        showToast(errorMessage(failed.reason))
      }
    },
    [endSession, showToast],
  )

  const startSession = useCallback(
    async (name: string, role: Role, userId: string, welcome: boolean, home: { block?: string; room?: string } = {}) => {
      roleRef.current = role
      setAuth({ loggedIn: true, role, name, userId, studentId: role === 'student' ? userId : null, block: home.block, room: home.room })
      setTabs({ ...DEFAULT_TABS })
      setFilters(DEFAULT_FILTERS)
      setReady(false)
      await refresh(TOPICS_FOR_ROLE[role])
      setReady(true)
      if (!welcome) return
      try {
        const unread = (await fetchNotifications()).filter((n) => !n.read).length
        if (unread) showToast(`You have ${unread} unread notification${unread === 1 ? '' : 's'} — check the bell.`)
      } catch {
        // The bell still shows the count once notifications load.
      }
    },
    [refresh, showToast],
  )

  // Stay logged in across page refreshes while the saved token is still valid.
  useEffect(() => {
    if (!getToken()) return
    apiMe()
      .then((user) => startSession(user.name, user.role, user.id, false, user))
      .catch(() => clearToken())
      .finally(() => setRestoring(false))
  }, [startSession])

  // Live updates: reload whatever changed as soon as any user saves something.
  useEffect(() => {
    if (!auth.loggedIn) return
    const close = connectLiveUpdates((topics) => void refresh(topics))
    // Catch up after the tab was in the background or the connection dropped.
    const onFocus = () => void refresh(ALL_TOPICS)
    window.addEventListener('focus', onFocus)
    return () => {
      close()
      window.removeEventListener('focus', onFocus)
    }
  }, [auth.loggedIn, auth.userId, refresh])

  const setTab = (tab: string) => {
    if (auth.role) setTabs((prev) => ({ ...prev, [auth.role as Role]: tab }))
  }

  // Runs a save on the server, reloads the affected data, then closes the window and confirms.
  async function save<T>(action: () => Promise<T>, topics: Topic[], success?: string | ((result: T) => string)) {
    try {
      const result = await action()
      await refresh(topics)
      setModal(null)
      if (success) showToast(typeof success === 'function' ? success(result) : success)
      return true
    } catch (err) {
      showToast(errorMessage(err))
      return false
    }
  }

  const markNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    apiReadAllNotifications().catch(() => undefined)
  }, [])

  const value: AppState = {
    route,
    setRoute,
    auth,
    restoring,
    ready,
    login: (name, role, userId, home) => void startSession(name, role, userId, true, home),
    logout: endSession,
    tabs,
    setTab,
    modal,
    setModal,
    toast,
    issues,
    notifications: notifications.filter((n) => isForUser(n, auth)),
    users,
    staff,
    categories,
    settings,
    filters,
    setFilters,
    addIssue: async (data) => {
      try {
        const issue = await apiCreateIssue(data)
        await refresh(ISSUE_TOPICS)
        setTab('reports')
        showToast('Report submitted — reference ' + issue.ref)
        return true
      } catch (err) {
        showToast(errorMessage(err))
        return false
      }
    },
    receiveIssue: (issue) =>
      save(() => apiReceiveIssue(issue.id), ISSUE_TOPICS, `${issue.ref} marked as received — the student can see it has been seen.`),
    assignIssue: (issue, staffId, priority) =>
      save(
        () => apiAssignIssue(issue.id, staffId, priority),
        ISSUE_TOPICS,
        `Assigned to ${staff.find((s) => s.id === staffId)?.name ?? 'maintenance'}.`,
      ),
    updateProgress: (issue, status, note) =>
      save(
        () => apiUpdateProgress(issue.id, status, note),
        ISSUE_TOPICS,
        status === 'Resolved'
          ? 'Marked as resolved — the student will be asked to confirm.'
          : status === 'Not Resolved'
            ? 'Marked as not resolved — the admin and student have been told why.'
            : 'Progress saved.',
      ),
    confirmResolution: (issue, rating, comment) =>
      save(() => apiConfirmResolution(issue.id, rating, comment), ISSUE_TOPICS, 'Thanks for confirming — the report is now closed.'),
    editReport: (issue, changes) => save(() => apiEditIssue(issue.id, changes), ISSUE_TOPICS, `${issue.ref} was updated.`),
    cancelReport: (issue) => save(() => apiCancelIssue(issue.id), ISSUE_TOPICS, `${issue.ref} was cancelled.`),
    reportNotFixed: (issue, reason) =>
      save(() => apiReportNotFixed(issue.id, reason), ISSUE_TOPICS, 'Issue re-opened — maintenance has been notified.'),
    addUser: (user) => save(() => apiAddUser(user), ['users', 'staff'], `${user.name} has been added.`),
    editUser: (userId, details) => {
      const name = users.find((u) => u.id === userId)?.name ?? 'User'
      return save(() => apiEditUser(userId, details), ['users', 'staff'], `${name} has been updated.`)
    },
    removeUser: (userId) => {
      const name = users.find((u) => u.id === userId)?.name ?? 'User'
      return save(
        () => apiRemoveUser(userId),
        ['users', 'staff', 'issues'],
        (res) => name + ' has been removed.' + (res.unassignedJobs ? ` ${res.unassignedJobs} open job(s) need re-assigning.` : ''),
      )
    },
    addCategory: (name, icon) => save(() => apiAddCategory(name, icon), ['categories'], `${name} category added.`),
    editCategory: (key, name, icon) => save(() => apiEditCategory(key, name, icon), ['categories'], 'Category updated.'),
    removeCategory: (key) => {
      const name = categories.find((c) => c.key === key)?.name ?? 'Category'
      return save(
        () => apiRemoveCategory(key),
        ['categories', 'issues'],
        (res) => name + ' category removed.' + (res.movedReports ? ` ${res.movedReports} report(s) moved to Other.` : ''),
      )
    },
    toggleSetting: (key) => {
      const current = settings.find((s) => s.key === key)
      return save(() => apiSetSetting(key, !current?.on), ['settings'])
    },
    markNotificationsRead,
    markNotificationRead: (id) => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
      apiReadNotification(id).catch(() => undefined)
    },
    catInfo: (key) => categories.find((c) => c.key === key) || categories[categories.length - 1],
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
