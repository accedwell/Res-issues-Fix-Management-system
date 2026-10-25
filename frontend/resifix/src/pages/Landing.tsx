import { Icon } from '../components/Icon'
import { useApp } from '../context/appContext'

export function Landing() {
  const { setRoute, setAuthRole } = useApp()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="topnav">
        <div className="container row">
          <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
            <span className="mark">RF</span>
            ResiFix
          </a>
          <nav>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                setAuthRole('admin')
                setRoute('signup')
              }}
            >
              For residences
            </a>
          </nav>
          <div className="actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setRoute('login')}>
              Log in
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setRoute('signup')}>
              Sign up
            </button>
          </div>
        </div>
      </div>

      <div className="hero">
        <div className="container">
          <div>
            <div className="hero-badge">
              <Icon name="shield" /> Built for university residences
            </div>
            <h1>
              Report residence issues. <span className="accent">Track them until they’re fixed.</span>
            </h1>
            <p className="lead">
              ResiFix gives students one place to report maintenance problems — and gives residence staff one place to
              organize, assign and resolve them.
            </p>
            <div className="cta">
              <button className="btn btn-primary" onClick={() => setRoute('signup')}>
                <Icon name="plus-circle" /> Report an issue
              </button>
              <button
                className="btn btn-ghost"
                style={{ background: 'rgba(255,255,255,.12)', color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}
                onClick={() => setRoute('login')}
              >
                I already have an account
              </button>
            </div>
          </div>
        </div>
      </div>

      <footer className="site">ResiFix — Student Residence Issue Reporting System · Prototype</footer>
    </div>
  )
}
