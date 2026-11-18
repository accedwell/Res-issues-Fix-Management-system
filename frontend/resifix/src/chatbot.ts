import { BLOCKS, CATEGORIES } from './data/constants'
import type { NewIssue, Priority } from './types'

export type ChatRole = 'assistant' | 'user'

export interface ChatMessage {
  id: string
  role: ChatRole
  text: string
  date: string
}

// Everything the assistant has collected so far. A field is only filled in when
// the student has actually mentioned it, so the assistant can ask for the gaps.
export interface ChatDraft {
  title?: string
  description?: string
  category?: string
  residence?: string
  room?: string
  priority?: Priority
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  plumbing: ['tap', 'leak', 'pipe', 'toilet', 'drain', 'sink', 'basin', 'shower', 'geyser', 'sewage', 'flush', 'blocked'],
  water: ['water supply', 'no water', 'burst pipe', 'water tank', 'water pressure', 'hot water', 'cold water', 'water'],
  electrical: ['plug', 'socket', 'power', 'electricity', 'trip', 'breaker', 'wiring', 'outage', 'electric shock', 'short circuit', 'sparking'],
  lighting: ['light', 'bulb', 'lamp', 'dark', 'flicker', 'fluorescent', 'tube light'],
  wifi: ['wifi', 'wi-fi', 'internet', 'network', 'router', 'signal', 'connection', 'ethernet'],
  furniture: ['chair', 'desk', 'bed', 'wardrobe', 'cupboard', 'table', 'furniture', 'drawer', 'mattress', 'door handle'],
  cleaning: ['dirty', 'clean', 'trash', 'bin', 'rubbish', 'spill', 'pest', 'cockroach', 'rat', 'mice', 'mold', 'mould'],
  security: ['lock', 'key', 'security', 'burglar', 'break-in', 'gate', 'fence', 'camera'],
  heating: ['heater', 'heating', 'aircon', 'air con', 'air conditioner', 'radiator', 'temperature', 'cold', 'hot water'],
  damage: ['broken window', 'crack', 'ceiling', 'wall', 'roof', 'floor', 'tile', 'damage', 'hole', 'window'],
}

const LOCATIONS = [
  'common room',
  'bathroom',
  'kitchen',
  'hallway',
  'corridor',
  'lobby',
  'reception',
  'laundry',
  'stairwell',
  'balcony',
  'parking',
  'side entrance',
  'study room',
  'tv room',
]

const URGENT_WORDS = [
  'fire',
  'smoke',
  'gas',
  'flood',
  'electric shock',
  'electrocution',
  'sparking',
  'emergency',
  'danger',
  'burst pipe',
  'no water',
  'no power',
]

const HIGH_WORDS = ['leak', 'broken', 'not working', 'urgent', 'locked out', 'no hot water', 'unsafe', 'security']

export function isAffirmative(text: string): boolean {
  const cleaned = text.trim().toLowerCase().replace(/[.!?]+$/, '')
  return (
    ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'submit', 'confirm', 'go ahead', 'do it', 'please do', 'yes please', 'correct'].includes(cleaned) ||
    /^(yes|yeah|yep|sure|ok|okay|confirm|submit|go ahead|do it)\b/.test(cleaned)
  )
}

export function isNegative(text: string): boolean {
  const cleaned = text.trim().toLowerCase().replace(/[.!?]+$/, '')
  return ['no', 'nope', 'cancel', 'stop', "don't", 'do not', 'not yet', 'no thanks'].includes(cleaned)
}

// Simple on-device NLP: score each category by the keywords it contains.
// Longer keywords count for more, so "water supply" beats a stray "water".
export function detectCategory(text: string): string {
  const lower = text.toLowerCase()
  let best = 'other'
  let bestScore = 0

  for (const [key, words] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = words.reduce((total, word) => (lower.includes(word) ? total + word.length : total), 0)
    if (score > bestScore) {
      bestScore = score
      best = key
    }
  }

  return best
}

export function detectPriority(text: string): Priority {
  const lower = text.toLowerCase()
  if (URGENT_WORDS.some((word) => lower.includes(word))) return 'Urgent'
  if (HIGH_WORDS.some((word) => lower.includes(word))) return 'High'
  if (lower.includes('minor') || lower.includes('cosmetic') || lower.includes('squeak')) return 'Low'
  return 'Normal'
}

export function detectBlock(text: string): string | undefined {
  const lower = text.toLowerCase()
  const exact = BLOCKS.find((block) => lower.includes(block.toLowerCase()))
  if (exact) return exact

  const match = lower.match(/\bblock\s*([a-f])\b/) || lower.match(/\b([a-f])\s*block\b/)
  if (match) return 'Block ' + match[1].toUpperCase()

  const trimmed = text.trim()
  if (/^[a-f]$/i.test(trimmed)) return 'Block ' + trimmed.toUpperCase()
  return undefined
}

export function detectRoom(text: string): string | undefined {
  const lower = text.toLowerCase()
  const location = LOCATIONS.find((place) => lower.includes(place))
  if (location) return location.replace(/\b\w/g, (char) => char.toUpperCase())

  const room = lower.match(/(?:room|rm|unit|flat|apartment)\s*[:#-]?\s*([a-z]?\d{1,4}[a-z]?)/)
  if (room) return room[1].toUpperCase()

  const compact = lower.match(/\b([a-f]\d{1,4})\b/)
  if (compact) return compact[1].toUpperCase()

  const trimmed = text.trim()
  if (/^\d{1,4}[a-z]?$/i.test(trimmed)) return trimmed.toUpperCase()
  return undefined
}

// A message like "Block B room 204" is only a location, not a problem description.
function descriptionCandidate(text: string): string | undefined {
  if (/^\d{1,4}[a-z]?$/i.test(text.trim())) return undefined

  let rest = text
    .replace(/\bblock\s*[a-f]\b/gi, ' ')
    .replace(/\b(?:room|rm|unit|flat|apartment)\s*[:#-]?\s*[a-z]?\d{1,4}[a-z]?\b/gi, ' ')
    .replace(/\b[a-f]\d{1,4}\b/gi, ' ')

  for (const place of LOCATIONS) {
    rest = rest.replace(new RegExp(`\\b${place}\\b`, 'gi'), ' ')
  }

  rest = rest
    .replace(/\b(?:in|at|on|the|my|our|is|it'?s|there'?s|please)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return rest.length >= 3 ? text.trim() : undefined
}

export function titleFrom(description: string, category?: string): string {
  const firstSentence = description.split(/[.!?]/)[0].trim() || description.trim()
  const shortened =
    firstSentence.length > 64 ? firstSentence.slice(0, 61).trimEnd() + '…' : firstSentence
  const title = shortened.charAt(0).toUpperCase() + shortened.slice(1)
  const catName = CATEGORIES.find((item) => item.key === category)?.name
  return catName && !title.toLowerCase().includes(catName.toLowerCase()) ? `${catName}: ${title}` : title
}

export function categoryName(key?: string): string {
  return CATEGORIES.find((item) => item.key === key)?.name ?? 'Other'
}

export function mergeDraft(draft: ChatDraft, message: string): ChatDraft {
  const next: ChatDraft = { ...draft }

  const category = detectCategory(message)
  if (!next.category || (category !== 'other' && next.category === 'other')) next.category = category

  const block = detectBlock(message)
  if (block) next.residence = block

  const room = detectRoom(message)
  if (room) next.room = room

  const priority = detectPriority(message)
  if (!next.priority || priority !== 'Normal') next.priority = priority

  const description = descriptionCandidate(message)
  if (description) {
    next.description = next.description ? `${next.description} ${description}` : description
  }

  if (!next.title && next.description) next.title = titleFrom(next.description, next.category)
  return next
}

export function isReady(draft: ChatDraft): boolean {
  return Boolean(draft.description && draft.residence && draft.room)
}

export function nextQuestion(draft: ChatDraft): string {
  if (!draft.description) {
    return "What exactly is the problem? For example: 'The bathroom tap is leaking.'"
  }
  if (!draft.residence) {
    return 'Which block is this in? (Block A–F)'
  }
  if (!draft.room) {
    return 'Which room or location? For example: 204, the common room, or the 2nd floor hallway.'
  }
  return 'Please tell me a little more about the problem.'
}

export function draftSummary(draft: ChatDraft, staffName?: string, staffSpecialization?: string): string {
  const lines = [
    'Here is what I have so far:',
    `• Problem: ${draft.description ?? '—'}`,
    `• Category: ${categoryName(draft.category)}`,
    `• Location: ${draft.residence ?? '—'}${draft.room ? ` · ${draft.room}` : ''}`,
    `• Priority: ${draft.priority ?? 'Normal'}`,
  ]
  if (staffName) lines.push(`• AI match: ${staffName} (${staffSpecialization ?? 'General Maintenance'})`)
  return lines.join('\n')
}

export function toNewIssue(draft: ChatDraft): NewIssue | null {
  if (!isReady(draft) || !draft.description || !draft.residence || !draft.room) return null

  return {
    title: draft.title || titleFrom(draft.description, draft.category),
    category: draft.category || 'other',
    priority: draft.priority || 'Normal',
    residence: draft.residence,
    room: draft.room,
    description: draft.description,
    photo: false,
  }
}
