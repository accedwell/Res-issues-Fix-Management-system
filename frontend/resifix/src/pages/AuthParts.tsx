import { Logo } from '../components/Logo'
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
      <span className="mark"><Logo /></span>
      <b>ResiFix</b>
    </a>
  )
}

