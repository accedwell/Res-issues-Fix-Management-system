import { EmptyState, IssueRow } from '../components/common'
import { useApp } from '../context/appContext'
import { isOpen, stop } from '../utils'

export function MaintenanceDashboard({ tab }: { tab: string }) {
  const { issues, setModal } = useApp()
  const completed = tab === 'completed'
  // The server only sends maintenance staff the jobs assigned to them.
  const tasks = issues.filter((i) => (completed ? !isOpen(i) : isOpen(i)))

  return (
    <div className="card">
      <h2>{completed ? 'Completed tasks' : 'Jobs assigned to you'}</h2>
      <p className="card-sub">{tasks.length} issue(s)</p>
      {tasks.length ? (
        tasks.map((issue) => (
          <IssueRow
            key={issue.id}
            issue={issue}
            extra={
              completed ? (
                <span className="status-pill status-closed">Done</span>
              ) : (
                <button className="btn btn-navy btn-sm" onClick={stop(() => setModal({ type: 'update', issueId: issue.id }))}>
                  Update
                </button>
              )
            }
          />
        ))
      ) : (
        <EmptyState
          icon="tools"
          title={completed ? 'Nothing completed yet' : 'No tasks assigned'}
          sub="New assignments from residence administrators will appear here."
        />
      )}
    </div>
  )
}
