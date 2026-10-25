import { useApp } from '../context/appContext'
import { AUTH_ROLES } from '../data/constants'

export function AuthBrand({ onClick }: { onClick: () => void }) {
  return (
    <a
      className="auth-brand"
      href="#"
      onClick={(e) => {
        e.preventDefault()
        onClick()
      }}
    >
      <span className="mark">RF</span>
      <b>ResiFix</b>
    </a>
  )
}

export function RolePicker() {
  const { authRole, setAuthRole } = useApp()

  return (
    <div className="role-grid">
      {AUTH_ROLES.map((role) => (
        <button
          key={role.key}
          type="button"
          className={'role-opt' + (authRole === role.key ? ' active' : '')}
          onClick={() => setAuthRole(role.key)}
        >
          {role.label}
        </button>
      ))}
    </div>
  )
}
