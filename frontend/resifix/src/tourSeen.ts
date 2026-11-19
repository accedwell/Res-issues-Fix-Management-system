// Whether someone has already taken (or skipped) the guided tour. Remembered per account in this
// browser, so the tour starts by itself only the first time; the "?" button replays it any time.

const seenKey = (userId: string) => `resifix-tour-seen:${userId}`

export function hasSeenTour(userId: string | null): boolean {
  if (!userId) return true
  try {
    return localStorage.getItem(seenKey(userId)) === '1'
  } catch {
    return false
  }
}

export function markTourSeen(userId: string | null) {
  if (!userId) return
  try {
    localStorage.setItem(seenKey(userId), '1')
  } catch {
    // Storage blocked: the tour may show again next time, which is harmless.
  }
}
