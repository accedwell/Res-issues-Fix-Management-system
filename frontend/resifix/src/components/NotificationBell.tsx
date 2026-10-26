import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { useApp } from '../context/appContext'
import { formatDate, isForUser } from '../utils'
import type { AppNotification } from '../types'

const MAX_SHOWN = 8

// Bell in the top bar with the unread count. Opens a list of recent notifications.
export function NotificationBell() {
  const { notifications, auth, issues, setModal, setTab, markNotificationRead, markNotificationsRead } = useApp()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  const mine = notifications.filter((n) => isForUser(n, auth))
  const unread = mine.filter((n) => !n.read).length

  // Close when clicking outside or pressing Escape.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const openNotification = (n: AppNotification) => {
    markNotificationRead(n.id)
    setOpen(false)
    if (n.issueId && issues.some((i) => i.id === n.issueId)) setModal({ type: 'detail', issueId: n.issueId })
  }

  return (
    <div className="bell-wrap" ref={wrap}>
      <button
        className="btn btn-ghost btn-sm bell-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Icon name="bell" />
        {unread > 0 && <span className="bell-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="bell-panel" role="dialog" aria-label="Notifications">
          <div className="bell-head">
            <b>Notifications</b>
            {unread > 0 && (
              <button className="bell-link" onClick={markNotificationsRead}>
                Mark all as read
              </button>
            )}
          </div>
          {mine.length ? (
            <ul className="bell-list">
              {mine.slice(0, MAX_SHOWN).map((n) => (
                <li key={n.id}>
                  <button className={'bell-item' + (n.read ? '' : ' unread')} onClick={() => openNotification(n)}>
                    <span className="bell-dot" aria-hidden="true" />
                    <span className="bell-text">
                      <span>{n.message}</span>
                      <time>{formatDate(n.date)}</time>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="bell-empty">You’re all caught up. New updates will appear here.</p>
          )}
          {auth.role === 'student' && mine.length > 0 && (
            <button
              className="bell-foot"
              onClick={() => {
                setOpen(false)
                setTab('notifications')
              }}
            >
              View all notifications
            </button>
          )}
        </div>
      )}
    </div>
  )
}
