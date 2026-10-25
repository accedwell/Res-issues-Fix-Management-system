import { Icon } from '../components/Icon'
import { useApp } from '../context/appContext'
import { CATEGORIES } from '../data/constants'

const STEPS = [
  { icon: 'plus-circle', title: 'Snap & report', text: 'Pick a category, add your room and a photo. Done in under a minute.' },
  { icon: 'users', title: 'We assign a fixer', text: 'Your residence admin routes it to the right maintenance person.' },
  { icon: 'bell', title: 'Watch it progress', text: 'Get notified at every stage — received, assigned, in progress.' },
  { icon: 'check-circle', title: 'Fixed & rated', text: 'Confirm the fix and rate the service, or re-open it if it’s not right.' },
]

const TICKET_STAGES = ['Submitted', 'Assigned', 'In progress', 'Fixed']

export function Landing() {
  const { setRoute } = useApp()

  // Only students sign up; staff accounts are created by the system administrator.
  const studentSignup = () => {
    setRoute('signup')
  }

  const staffLogin = () => setRoute('login')

  return (
    <div className="landing">
      <header className="topnav">
        <div className="container row">
          <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
            <span className="mark">RF</span>
            ResiFix
          </a>
          <nav>
            <a href="#how">How it works</a>
            <a href="#categories">What to report</a>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                staffLogin()
              }}
            >
              Staff login
            </a>
          </nav>
          <div className="actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setRoute('login')}>
              Log in
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => studentSignup()}>
              Sign up
            </button>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="hero-photo" aria-hidden="true" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="hero-badge">
              <span className="pulse" /> Built for university residences
            </div>
            <h1>
              Something broken in res?
              <span className="accent">Let’s get it fixed.</span>
            </h1>
            <p className="lead">
              Leaking taps, dead lights, flaky Wi-Fi — report it from your phone in under a minute and follow it all
              the way to fixed. No more chasing the res office.
            </p>
            <div className="cta">
              <button className="btn btn-primary btn-lg" onClick={() => studentSignup()}>
                <Icon name="plus-circle" /> Report an issue
              </button>
              <button className="btn btn-glass btn-lg" onClick={() => setRoute('login')}>
                I already have an account <Icon name="arrow-right" />
              </button>
            </div>
            <div className="hero-perks">
              <span>
                <Icon name="check-circle" /> Free for students
              </span>
              <span>
                <Icon name="check-circle" /> Live status updates
              </span>
              <span>
                <Icon name="check-circle" /> Report 24/7
              </span>
            </div>
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="hero-ticket">
              <div className="ticket-head">
                <div className="issue-cat-badge">
                  <Icon name="tap" />
                </div>
                <div>
                  <div className="ref">RF-2048 · Block C, Room 204</div>
                  <div className="title">Leaking bathroom tap</div>
                </div>
                <span className="status-pill status-inprogress">In progress</span>
              </div>
              <ol className="ticket-steps">
                {TICKET_STAGES.map((stage, i) => (
                  <li key={stage} className={i < 3 ? 'done' : ''} style={{ animationDelay: `${0.4 + i * 0.35}s` }}>
                    <span className="step-dot">{i < 3 ? <Icon name="check" /> : null}</span>
                    {stage}
                  </li>
                ))}
              </ol>
              <div className="ticket-tech">
                <div className="av">TN</div>
                <div>
                  <b>Thabo N.</b>
                  <span>Plumbing · on the way</span>
                </div>
                <Icon name="tools" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="categories">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">What can you report?</span>
            <h2>If it’s broken, leaking or flickering — log it.</h2>
            <p>Pick from the most common residence problems, or choose “Other” for anything else.</p>
          </div>
          <div className="category-grid">
            {CATEGORIES.map((c) => (
              <button key={c.key} className="category-tile" onClick={() => studentSignup()}>
                <span className="badge">
                  <Icon name={c.icon} />
                </span>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt" id="how">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">How it works</span>
            <h2>From “ugh, it’s broken” to fixed in four steps</h2>
            <p>Every report is tracked, so nothing slips through the cracks.</p>
          </div>
          <div className="step-grid">
            {STEPS.map((step, i) => (
              <div key={step.title} className="step-card">
                <span className="step-num">0{i + 1}</span>
                <span className="badge">
                  <Icon name={step.icon} />
                </span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container">
        <div className="cta-band">
          <div>
            <h2>Your room should just work.</h2>
            <p>Join ResiFix and report your first issue today.</p>
          </div>
          <button className="btn btn-light btn-lg" onClick={() => studentSignup()}>
            Create a free account <Icon name="arrow-right" />
          </button>
        </div>
      </section>

      <footer className="site">
        <div className="container">
          <span className="brand">
            <span className="mark">RF</span>
            ResiFix
          </span>
          <span>Student Residence Issue Reporting System · Prototype</span>
        </div>
      </footer>
    </div>
  )
}
