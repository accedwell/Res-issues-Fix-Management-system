import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AppContext, type AppState } from './appContext'
import {
  apiAddCategory, apiAddUser, apiEditUser, apiAssignIssue, apiReceiveIssue, apiConfirmResolution, apiCreateIssue, apiEditCategory, apiMe,
  apiReadAllNotifications, apiReadNotification, apiRemoveCategory, apiRemoveUser, apiReportNotFixed, apiEditIssue, apiCancelIssue, apiSetSetting,
  apiSubmitAssistantReport, apiUpdateProgress, apiAcceptJob, apiDeclineJob, apiAcceptedByPhone, apiStaffClockIn, apiStaffClockOut, apiStaffBreak, apiStaffEndBreak, clearToken, connectLiveUpdates, fetchCategories, fetchIssues, fetchNotifications, fetchSettings,
  fetchStaff, fetchUsers, getToken, type ApiUser, type Topic, fetchParts, apiTakePart, apiRequestPart, apiRestockPart, apiAddPart, apiEditPart,
  apiRemovePart, apiClockIn, apiClockOut, apiStartBreak, apiEndBreak, fetchMyDuty,
} from '../api'
import { CATEGORIES, DEFAULT_FILTERS, DEFAULT_TABS, ROLE_NAMES } from '../data/constants'
import { emitCallSignal } from '../callBus'
import { isForUser, isOverdue } from '../utils'
import type { AppNotification, Auth, DutyStatus, Category, Filters, Issue, Modal, Role, Route, Setting, SparePart, Staff, StockMovement, User } from '../types'

const LOGGED_OUT: Auth = { loggedIn: false, role: null, name: null, userId: null, studentId: null }

const ALL_TOPICS: Topic[] = ['issues', 'notifications', 'users', 'staff', 'categories', 'settings', 'parts', 'duty']
const ISSUE_TOPICS: Topic[] = ['issues', 'notifications', 'staff']

// Which data each role is allowed to load from the server.
const TOPICS_FOR_ROLE: Record<Role, Topic[]> = {
  student: ['issues', 'notifications', 'categories'],
  maintenance: ['issues', 'notifications', 'categories', 'parts', 'duty'],
  admin: ['issues', 'notifications', 'categories', 'staff', 'parts'],
  sysadmin: ['issues', 'notifications', 'categories', 'staff', 'users', 'settings'],
  supervisor: ['issues', 'notifications', 'categories', 'staff'],
}

// The user list shows one "details" column: room for students, job for maintenance staff.
function toUserRow(user: ApiUser): User {
  const extra =
    user.role === 'student'
      ? [user.block, user.room && 'Room ' + user.room].filter(Boolean).join(' · ')
      : user.role === 'maintenance'
        ? [user.specialization, user.phone].filter(Boolean).join(' · ')
        : (user.phone ?? '')
  return {
    id: user.id, name: user.name, role: ROLE_NAMES[user.role], email: user.email, extra: extra || '—',
    kind: user.role, block: user.block, room: user.room, specialization: user.specialization, phone: user.phone,
  }
}

// Scanning the clock-in QR code opens ResiFix at #clock-in=CODE. The code is kept for this tab
// (so it survives logging in first) and taken out of the address bar.
const CLOCK_IN_KEY = 'resifix-clock-in'
function readClockInLink(): string | null {
  const match = /^#clock-in=([A-Za-z0-9]{4,12})$/.exec(window.location.hash)
  try {
    if (match) {
      sessionStorage.setItem(CLOCK_IN_KEY, match[1])
      history.replaceState(null, '', window.location.pathname + window.location.search)
      return match[1]
    }
    return sessionStorage.getItem(CLOCK_IN_KEY)
  } catch {
    return match?.[1] ?? null
  }
}
function forgetClockInLink() {
  try {
    sessionStorage.removeItem(CLOCK_IN_KEY)
  } catch {
    // Nothing saved.
  }
}

// Attendance messages the staff manager gets a pop-up for, as they happen.
const DUTY_ALERT = /^(Clocked (in|out)|Not clocked in|On break|Back from break|Handed back):/
// Updates a student should see the moment they happen: who their report was assigned to, when that
// person accepts it, and when it is fixed or could not be fixed. Their own actions are left out.
const STUDENT_ALERT = /has been assigned to|is waiting for a technician|accepted the job|has been marked Resolved|could not be resolved|is now (In Progress|Received)/

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong. Please try again.')

export function AppProvider({ children }: { children: ReactNode }) {
  const [pendingClockIn, setPendingClockIn] = useState(readClockInLink)
  // Someone who scanned the QR code while logged out goes straight to the login page.
  const [route, setRoute] = useState<Route>(() => (pendingClockIn ? 'login' : 'landing'))
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
  const [parts, setParts] = useState<SparePart[]>([])
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [duty, setDuty] = useState<DutyStatus | null>(null)

  // The live-update handler runs outside React renders, so it reads the current role from here.
  const roleRef = useRef<Role | null>(null)
  // Notifications already shown, so only ones that arrive while logged in pop up (null before the first load).
  const seenNotifications = useRef<Set<string> | null>(null)

  const showToast = useCallback((msg: string) => setToast({ msg, id: Date.now() }), [])

  useEffect(() => {
    if (!toast) return
    // Longer messages (like a clock-in alert) stay up longer so they can be read.
    const timer = setTimeout(() => setToast(null), Math.min(8000, Math.max(3500, toast.msg.length * 70)))
    return () => clearTimeout(timer)
  }, [toast])

  const endSession = useCallback(() => {
    clearToken()
    roleRef.current = null
    seenNotifications.current = null
    setModal(null)
    setAuth(LOGGED_OUT)
    setIssues([])
    setNotifications([])
    setUsers([])
    setStaff([])
    setSettings([])
    setParts([])
    setStockMovements([])
    setDuty(null)
    setFilters(DEFAULT_FILTERS)
    setRoute('landing')
  }, [])

  // Reloads the given kinds of data from the server (only those this role may see).
  const refresh = useCallback(
    async (topics: Topic[]) => {
      const role = roleRef.current
      if (!role) return
      let loadedIssues: Issue[] | undefined
      const wanted = topics.filter((t) => TOPICS_FOR_ROLE[role].includes(t))
      const loaders: Record<Topic, () => Promise<void>> = {
        issues: async () => {
          loadedIssues = await fetchIssues()
          if (roleRef.current === role) setIssues(loadedIssues)
        },
        notifications: async () => {
          const list = await fetchNotifications()
          // The staff manager gets a pop-up the moment someone clocks in or out.
          const seen = seenNotifications.current
          if (seen && (role === 'admin' || role === 'supervisor')) {
            const clock = list.filter((n) => !seen.has(n.id) && !n.read && DUTY_ALERT.test(n.message))
            if (clock.length) showToast(clock.length === 1 ? clock[0].message : `${clock.length} attendance updates — check the bell.`)
          }
          // A student gets a pop-up the moment their report is assigned, accepted or fixed.
          if (seen && role === 'student') {
            const news = list.filter((n) => !seen.has(n.id) && !n.read && STUDENT_ALERT.test(n.message))
            if (news.length) showToast(news.length === 1 ? news[0].message : `${news.length} updates on your reports — check the bell.`)
          }
          seenNotifications.current = new Set(list.map((n) => n.id))
          setNotifications(list)
        },
        categories: async () => setCategories(await fetchCategories()),
        staff: async () => setStaff(await fetchStaff()),
        users: async () => setUsers((await fetchUsers()).map(toUserRow)),
        settings: async () => setSettings(await fetchSettings()),
        parts: async () => {
          const store = await fetchParts()
          setParts(store.parts)
          setStockMovements(store.movements)
        },
        duty: async () => setDuty(await fetchMyDuty()),
      }
      const results = await Promise.allSettled(wanted.map((t) => loaders[t]()))
      const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
      if (!failed) return loadedIssues
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

  // Finishes a clock-in from the QR link: right after logging in, or at once when already logged in.
  // Returns true when there was one. The code is forgotten first, so it can only run once.
  const finishClockIn = useCallback(
    async (role: Role) => {
      const code = readClockInLink()
      if (!code) return false
      forgetClockInLink()
      setPendingClockIn(null)
      if (role !== 'maintenance') {
        showToast('Only maintenance technicians clock in with this QR code.')
        return true
      }
      try {
        await apiClockIn(code)
        await refresh(['duty', 'issues', 'notifications'])
        showToast('You are clocked in. New jobs can come to you now.')
      } catch (err) {
        showToast(errorMessage(err))
      }
      return true
    },
    [refresh, showToast],
  )

  const startSession = useCallback(
    async (name: string, role: Role, userId: string, welcome: boolean, home: { block?: string; room?: string } = {}) => {
      roleRef.current = role
      setAuth({ loggedIn: true, role, name, userId, studentId: role === 'student' ? userId : null, block: home.block, room: home.room })
      setTabs({ ...DEFAULT_TABS })
      setFilters(DEFAULT_FILTERS)
      setModal(null)
      setReady(false)
      const loadedIssues = await refresh(TOPICS_FOR_ROLE[role])
      if (roleRef.current !== role) return
      setReady(true)
      if (role === 'student' && loadedIssues?.some((issue) => issue.studentId === userId && isOverdue(issue))) {
        setModal({ type: 'overdue' })
      }
      if ((await finishClockIn(role)) || !welcome) return
      try {
        const unread = (await fetchNotifications()).filter((n) => !n.read).length
        if (unread) showToast(`You have ${unread} unread notification${unread === 1 ? '' : 's'} — check the bell.`)
      } catch {
        // The bell still shows the count once notifications load.
      }
    },
    [refresh, showToast, finishClockIn],
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
    const close = connectLiveUpdates((topics) => void refresh(topics), emitCallSignal)
    // Catch up after the tab was in the background or the connection dropped.
    const onFocus = () => void refresh(ALL_TOPICS)
    window.addEventListener('focus', onFocus)
    return () => {
      close()
      window.removeEventListener('focus', onFocus)
    }
  }, [auth.loggedIn, auth.userId, refresh])

  // Scanning the QR code again while ResiFix is already open in this tab.
  useEffect(() => {
    const onHash = () => {
      const code = readClockInLink()
      if (!code) return
      if (roleRef.current) {
        void finishClockIn(roleRef.current)
      } else {
        setPendingClockIn(code)
        setRoute('login')
      }
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [finishClockIn])

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
    refreshIssues: () => void refresh(['issues', 'notifications']),
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
    parts,
    stockMovements,
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
    addAssistantIssue: async (report) => {
      try {
        const issue = await apiSubmitAssistantReport(report)
        await refresh(ISSUE_TOPICS)
        setTab('reports')
        showToast(
          issue.assignedToName
            ? `Report ${issue.ref} assigned to ${issue.assignedToName} — waiting for them to accept the job.`
            : `Report ${issue.ref} submitted. Nobody is on duty right now — you will be told who it is assigned to as soon as a technician clocks in.`,
        )
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
            ? 'Marked as not resolved — the staff manager and student have been told why.'
            : 'Progress saved.',
      ),
    confirmResolution: (issue, rating, comment) =>
      save(() => apiConfirmResolution(issue.id, rating, comment), ISSUE_TOPICS, 'Thanks for confirming — the report is now closed.'),
    editReport: (issue, changes) => save(() => apiEditIssue(issue.id, changes), ISSUE_TOPICS, `${issue.ref} was updated.`),
    cancelReport: (issue) => save(() => apiCancelIssue(issue.id), ISSUE_TOPICS, `${issue.ref} was cancelled.`),
    reportNotFixed: (issue, reason) =>
      save(() => apiReportNotFixed(issue.id, reason), ISSUE_TOPICS, 'Report sent again — the residence team has been notified.'),
    acceptJob: (issue) => save(() => apiAcceptJob(issue.id), ISSUE_TOPICS, `You accepted ${issue.ref}. The student has been told.`),
    declineJob: (issue, reason) =>
      save(() => apiDeclineJob(issue.id, reason), ISSUE_TOPICS, (result) =>
        result.passedTo
          ? `You declined ${issue.ref}. It was passed to ${result.passedTo}.`
          : `You declined ${issue.ref}. The staff manager will assign it to someone else.`,
      ),
    confirmAcceptedByPhone: (issue) =>
      save(
        () => apiAcceptedByPhone(issue.id),
        ISSUE_TOPICS,
        `Recorded: ${issue.assignedToName ?? staff.find((s) => s.id === issue.assignedTo)?.name ?? 'the technician'} accepted ${issue.ref} over the phone.`,
      ),
    updateAvailability: (tech, action, extra = {}) => {
      const steps = {
        clockIn: [() => apiStaffClockIn(tech.id), `${tech.name} is clocked in and can get new jobs.`],
        clockOut: [() => apiStaffClockOut(tech.id, extra.handBack ?? []), `${tech.name} is clocked out.`],
        startBreak: [() => apiStaffBreak(tech.id, extra.minutes ?? 15), `${tech.name} is on a ${extra.minutes ?? 15}-minute break.`],
        endBreak: [() => apiStaffEndBreak(tech.id), `${tech.name} is back from break.`],
      } as const
      const [call, message] = steps[action]
      return save(call, ['staff', 'issues', 'notifications'], message)
    },
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
    takePart: (part, quantity, issueId, note) =>
      save(
        () => apiTakePart(part.id, quantity, issueId, note),
        ['parts'],
        (res) => `Took ${quantity} × ${part.name}. ${res.part.quantity} left in the store.`,
      ),
    requestPart: (part, note) =>
      save(() => apiRequestPart(part.id, note), ['parts'], `The staff manager has been asked to restock ${part.name}.`),
    restockPart: (part, quantity, note) =>
      save(
        () => apiRestockPart(part.id, quantity, note),
        ['parts'],
        (res) => `Added ${quantity} × ${part.name}. ${res.part.quantity} now in the store.`,
      ),
    addPart: (part) => save(() => apiAddPart(part), ['parts'], `${part.name} added to the store.`),
    editPart: (id, part) => save(() => apiEditPart(id, part), ['parts'], `${part.name} updated.`),
    removePart: (part) => save(() => apiRemovePart(part.id), ['parts'], `${part.name} removed from the store.`),
    duty,
    pendingClockIn: !!pendingClockIn,
    clockIn: (code) =>
      save(() => apiClockIn(code), ['duty', 'issues', 'notifications'], 'You are clocked in. New jobs can come to you now.'),
    clockOut: (handBack) =>
      save(
        () => apiClockOut(handBack),
        ['duty', 'issues', 'notifications'],
        handBack.length
          ? `You are clocked out. ${handBack.length} job(s) handed back to the staff manager.`
          : 'You are clocked out. Jobs you already have stay yours.',
      ),
    startBreak: (minutes) => save(() => apiStartBreak(minutes), ['duty'], `Enjoy your break. No new jobs for ${minutes} minutes.`),
    endBreak: () => save(() => apiEndBreak(), ['duty', 'issues', 'notifications'], 'Welcome back. New jobs can come to you again.'),
    markNotificationsRead,
    markNotificationRead: (id) => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
      apiReadNotification(id).catch(() => undefined)
    },
    catInfo: (key) => categories.find((c) => c.key === key) || categories[categories.length - 1],
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
