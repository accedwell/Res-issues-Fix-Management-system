import type { Role } from './types'

// Backend address. Override with VITE_API_URL in a .env file if it runs elsewhere.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const TOKEN_KEY = 'resifix-token'

export interface ApiUser {
  id: string
  name: string
  email: string
  role: Role
}

interface AuthResponse {
  token: string
  user: ApiUser
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let token: string | null = null
  try {
    token = localStorage.getItem(TOKEN_KEY)
  } catch {
    // Storage can be blocked (private mode); requests just go without a token.
  }

  let res: Response
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new Error('Cannot reach the ResiFix server. Make sure the backend is running.')
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.')
  return data as T
}

function saveToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Ignore — the user stays logged in until the page is refreshed.
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Nothing to clear.
  }
}

export async function apiLogin(email: string, password: string): Promise<ApiUser> {
  const { token, user } = await request<AuthResponse>('POST', '/auth/login', { email, password })
  saveToken(token)
  return user
}

export interface SignupInput {
  firstName: string
  lastName: string
  studentNumber: string
  email: string
  block: string
  room: string
  password: string
}

export async function apiSignup(input: SignupInput): Promise<ApiUser> {
  const { token, user } = await request<AuthResponse>('POST', '/auth/signup', input)
  saveToken(token)
  return user
}
