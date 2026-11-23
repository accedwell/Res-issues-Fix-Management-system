import { AllIssues, Overview, Reports } from './AdminDashboard'
import { Assignments } from './Assignments'
import { TeamAvailability } from './TeamAvailability'

// The supervisor assigns jobs to technicians (the staff manager no longer does), follows whether they
// accept them, can update a technician's availability for them, and sees the same reports as the
// staff manager.
export function SupervisorDashboard({ tab }: { tab: string }) {
  if (tab === 'issues') return <AllIssues />
  if (tab === 'assignments') return <Assignments />
  if (tab === 'availability') return <TeamAvailability />
  if (tab === 'reports') return <Reports />
  return <Overview />
}
