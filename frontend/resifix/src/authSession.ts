const TOKEN_KEY = 'resifix-token'
let memoryToken: string | null = null

// Keep each tab's requests tied to the account displayed in that tab.
// localStorage was shared across tabs, so another login could replace a supervisor's token.
export function getToken(): string | null {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY)
    if (token) return token
    if (memoryToken) return memoryToken

    // Move an existing login from the previous shared storage on first use.
    const legacy = localStorage.getItem(TOKEN_KEY)
    if (legacy) saveToken(legacy)
    return legacy
  } catch {
    return memoryToken
  }
}

export function saveToken(token: string) {
  memoryToken = token
  try {
    sessionStorage.setItem(TOKEN_KEY, token)
  } catch {
    // With storage blocked, keep this tab signed in until it reloads.
  }
  removeLegacyToken()
}

function removeLegacyToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Browser storage may be disabled.
  }
}

export function clearToken() {
  memoryToken = null
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // The in-memory session is still cleared when storage is blocked.
  }
  removeLegacyToken()
}
