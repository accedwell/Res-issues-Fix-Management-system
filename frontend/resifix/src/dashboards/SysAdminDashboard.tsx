import { Assignments } from './Assignments'
import { TeamAvailability } from './TeamAvailability'
import { Icon } from '../components/Icon'
import { useApp } from '../context/appContext'
import { BLOCKS } from '../data/constants'

export function SysAdminDashboard({ tab }: { tab: string }) {
  if (tab === 'assignments') return <Assignments />
  if (tab === 'availability') return <TeamAvailability />
  if (tab === 'categories') return <Categories />
  if (tab === 'settings') return <Settings />
  return <Users />
}

function Users() {
  const { users, setModal } = useApp()

  return (
    <div className="card">
      <div className="card-head">
        <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'addUser' })}>
          <Icon name="plus-circle" /> Add user
        </button>
      </div>
      {/* On a phone each user becomes a card; data-label names each value there. */}
      <table className="simple users-table">
        <tbody>
          <tr className="users-head">
            <th>Name</th>
            <th>Role</th>
            <th>Email</th>
            <th>Details</th>
            <th />
          </tr>
          {users.map((user) => (
            <tr key={user.id}>
              <td data-label="Name">{user.name}</td>
              <td data-label="Role">{user.role}</td>
              <td data-label="Email">{user.email}</td>
              <td data-label="Details">{user.extra}</td>
              <td className="users-actions">
                <span style={{ display: 'inline-flex', gap: 6 }}>
                  {/* Only students (block, room) and maintenance staff (job type) have details to correct. */}
                  {(user.kind === 'student' || user.kind === 'maintenance') && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setModal({ type: 'editUser', userId: user.id })}>
                      Edit
                    </button>
                  )}
                  <button className="btn btn-danger-ghost btn-sm" onClick={() => setModal({ type: 'removeUser', userId: user.id })}>
                    <Icon name="x" /> Remove
                  </button>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Categories() {
  const { categories, setModal } = useApp()

  return (
    <div className="card">
      <div className="card-head">
        <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'addCategory' })}>
          <Icon name="plus-circle" /> Add category
        </button>
      </div>
      <ul className="list-plain">
        {categories.map((c) => (
          <li key={c.key}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name={c.icon} />
              {c.name}
            </span>
            <span style={{ display: 'inline-flex', gap: 6 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal({ type: 'editCategory', categoryKey: c.key })}>
                Edit
              </button>
              {c.key === 'other' ? (
                <span className="field-hint" style={{ alignSelf: 'center' }}>
                  Default — can’t remove
                </span>
              ) : (
                <button
                  className="btn btn-danger-ghost btn-sm"
                  onClick={() => setModal({ type: 'removeCategory', categoryKey: c.key })}
                >
                  <Icon name="x" /> Remove
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Settings() {
  const { settings, toggleSetting } = useApp()

  return (
    <div className="card">
      <ul className="list-plain">
        {settings.map((s) => (
          <li key={s.key}>
            {s.label}
            <button className={'btn btn-sm ' + (s.on ? 'btn-primary' : 'btn-ghost')} onClick={() => toggleSetting(s.key)}>
              {s.on ? 'On' : 'Off'}
            </button>
          </li>
        ))}
      </ul>
      <div className="card" style={{ marginTop: 14, background: 'var(--bg)' }}>
        <h2 style={{ fontSize: 13 }}>Blocks</h2>
        <ul className="list-plain">
          {BLOCKS.map((block) => (
            <li key={block}>
              {block}
              <span style={{ color: 'var(--ink-soft)', fontSize: 11.5 }}>Active</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
