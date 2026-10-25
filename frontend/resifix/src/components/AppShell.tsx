import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { ModalHost } from './Modals'
import { useApp } from '../context/appContext'
import { NAV, PAGE_TITLES, ROLE_NAMES } from '../data/constants'
import { AdminDashboard } from '../dashboards/AdminDashboard'
import { MaintenanceDashboard } from '../dashboards/MaintenanceDashboard'
import { StudentDashboard } from '../dashboards/StudentDashboard'
import { SysAdminDashboard } from '../dashboards/SysAdminDashboard'
import { initials } from '../utils'
import type { Role } from '../types'

const DASHBOARDS = {
  student: StudentDashboard,
  admin: AdminDashboard,
  maintenance: MaintenanceDashboard,
  sysadmin: SysAdminDashboard,
}

export function AppShell() {
  const { auth, tabs, setTab, logout, toast } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)
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
            <span className="mark">RF</span>
            ResiFix
          </a>
          <div className="side-role">{ROLE_NAMES[role]}</div>
          <div className="side-nav">
            {NAV[role].map((item) => (
              <button
                key={item.key}
                className={'side-link' + (tab === item.key ? ' active' : '')}
                onClick={() => goTo(item.key)}
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
              {role === 'student' && (
                <button className="btn btn-primary btn-sm" onClick={() => setTab('report')}>
                  <Icon name="plus-circle" /> Report Issue
                </button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={logout}>
                <Icon name="logout" /> Log out
              </button>
            </div>
          </div>
          <div className="content">
            <Dashboard tab={tab} />
          </div>
        </div>
      </div>
      <ModalHost />
      {toast && (
        <div key={toast.id} className="toast" role="status">
          {toast.msg}
        </div>
      )}
    </>
  )
}
