import { Icon } from './Icon'
import { stop, telHref } from '../utils'

// A phone link for calling a technician, e.g. one who has not accepted a job. On a phone it opens
// the dialler; on a computer it opens whatever app handles calls (such as Phone Link on Windows).
export function CallButton({ phone, name, compact = false }: { phone?: string | null; name?: string | null; compact?: boolean }) {
  if (!phone) {
    if (compact) return <span className="call-missing">No phone saved</span>
    return <span className="call-missing">No phone number saved for {name ?? 'this technician'} — the system admin can add it under Users.</span>
  }
  return (
    <a
      className="btn btn-primary btn-sm phone-call-btn"
      href={telHref(phone)}
      onClick={stop(() => undefined)}
      title={`Call ${name ?? 'the technician'} on ${phone}`}
    >
      <Icon name="phone" /> {compact ? 'Call' : `Call ${phone}`}
    </a>
  )
}
