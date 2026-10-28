import { useEffect, useState } from 'react'
import { fetchIssuePhoto } from '../api'
import type { Issue } from '../types'

// The photo the student attached, in the report details. Tap it to open it full size.
export function IssuePhoto({ issue }: { issue: Issue }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!issue.photo) return
    let link: string | null = null
    let current = true
    fetchIssuePhoto(issue.id)
      .then((found) => {
        link = found
        if (current) setUrl(found)
        else URL.revokeObjectURL(found)
      })
      .catch(() => current && setFailed(true))
    return () => {
      current = false
      if (link) URL.revokeObjectURL(link)
    }
  }, [issue.id, issue.photo])

  if (!issue.photo) return null
  if (failed) return <p className="issue-photo-note">The photo could not be loaded.</p>
  if (!url) return <div className="issue-photo issue-photo-loading" aria-label="Loading photo" />

  return (
    <a className="issue-photo" href={url} target="_blank" rel="noreferrer" title="Open full size">
      <img src={url} alt={`Photo of: ${issue.title}`} />
    </a>
  )
}
