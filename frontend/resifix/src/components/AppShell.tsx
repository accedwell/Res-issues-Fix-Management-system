import { Logo } from './Logo'
import { useEffect, useState } from 'react'
import { CallManager } from './CallManager'
import { GuidedTour } from './GuidedTour'
import { hasSeenTour } from '../tourSeen'
import { Icon } from './Icon'
import { ModalHost } from './Modals'
import { NotificationBell } from './NotificationBell'
import { useApp } from '../context/appContext'
import { NAV, PAGE_TITLES, ROLE_NAMES } from '../data/constants'
import { AdminDashboard } from '../dashboards/AdminDashboard'
import { MaintenanceDashboard } from '../dashboards/MaintenanceDashboard'
import { StudentDashboard } from '../dashboards/StudentDashboard'
import { SupervisorDashboard } from '../dashboards/SupervisorDashboard'
import { SysAdminDashboard } from '../dashboards/SysAdminDashboard'
import { initials } from '../utils'
import type { Role } from '../types'

const DASHBOARDS = {
  student: StudentDashboard,
  admin: AdminDashboard,
  maintenance: MaintenanceDashboard,
  sysadmin: SysAdminDashboard,
  supervisor: SupervisorDashboard,
}

export function AppShell() {
  const { auth, tabs, setTab, logout, toast, ready } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)
  // The guided tour starts by itself the first time this account logs in on this browser ("auto"),
  // and the "?" button opens it again. It waits behind any pop-up, such as a reminder.
  const [tour, setTour] = useState<'auto' | 'open' | 'closed'>('auto')
  const tourOpen = ready && (tour === 'open' || (tour === 'auto' && !hasSeenTour(auth.userId)))
  const role = auth.role as Role
  const tab = tabs[role]
  const Dashboard = DASHBOARDS[role]

  useEffect(() => {
    document.body.classList.add('in-app')
    return () => document.body.classList.remove('in-app', 'sidebar-open')
  }, [])

  useEffect(() => {
    document.body.classList.toggle('sidebar-open', menuOpen)
  }, [menuOpen])

  // Close the mobile menu after moving to another page.
  const goTo = (key: string) => {
    setTab(key)
    setMenuOpen(false)
  }

  return (
    <>
      <div style={{ display: 'flex', flex: 1, minWidth: 0, width: '100%' }}>
        <div className="sidebar">
          <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
            <span className="mark"><Logo /></span>
            ResiFix
          </a>
          <div className="side-role">{ROLE_NAMES[role]}</div>
          <div className="side-nav">
            {NAV[role].map((item) => (
              <button
                key={item.key}
                className={'side-link' + (tab === item.key ? ' active' : '')}
                onClick={() => goTo(item.key)}
                data-tour={'nav-' + item.key}
              >
                <Icon name={item.icon} />
                {item.label}
              </button>
            ))}
          </div>
          <div className="side-foot">
            <div className="side-user">
              <div className="av">{initials(auth.name ?? '')}</div>
              <div className="meta">
                <b>{auth.name}</b>
                <span>{ROLE_NAMES[role]}</span>
              </div>
            </div>
            <button className="side-link" onClick={logout}>
              <Icon name="logout" />
              Log out
            </button>
          </div>
        </div>

        <div className="main">
          <div className="topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                className="btn btn-ghost btn-sm menu-toggle"
                aria-label="Menu"
                onClick={() => setMenuOpen((open) => !open)}
              >
                <Icon name="menu" />
              </button>
              <h1>{PAGE_TITLES[role][tab] || ''}</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                className="btn btn-ghost btn-sm tour-help"
                onClick={() => {
                  setMenuOpen(false)
                  setTour('open')
                }}
                aria-label="Show me around"
                title="Show me around"
                data-tour="help"
              >
                <Icon name="help" />
              </button>
              <span data-tour="bell" style={{ display: 'inline-flex' }}>
                <NotificationBell />
              </span>
              <button className="btn btn-ghost btn-sm" onClick={logout}>
                <Icon name="logout" /> Log out
              </button>
            </div>
          </div>
          <div className="content">
            {ready ? <Dashboard tab={tab} /> : <div className="app-loading">Loading your dashboard…</div>}
          </div>
        </div>
      </div>
      <ModalHost />
      {tourOpen && <GuidedTour key={tour} onClose={() => setTour('closed')} />}
      {/* Voice calls work on any page, so an incoming call can ring wherever the person is. */}
      {(role === 'student' || role === 'maintenance') && <CallManager />}
      {toast && (
        <div key={toast.id} className="toast" role="status">
          {toast.msg}
        </div>
      )}
    </>
  )
}
