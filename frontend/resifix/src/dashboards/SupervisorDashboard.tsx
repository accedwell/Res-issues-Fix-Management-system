import { AllIssues, Overview } from './AdminDashboard'
import { Assignments } from './Assignments'
import { TeamAvailability } from './TeamAvailability'

// The supervisor assigns jobs to technicians (the staff manager no longer does), follows whether they
// accept them, and can update a technician's availability for them.
export function SupervisorDashboard({ tab }: { tab: string }) {
  if (tab === 'issues') return <AllIssues />
  if (tab === 'assignments') return <Assignments />
  if (tab === 'availability') return <TeamAvailability />
  return <Overview />
}
