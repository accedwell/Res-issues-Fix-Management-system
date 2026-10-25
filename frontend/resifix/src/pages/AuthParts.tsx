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

