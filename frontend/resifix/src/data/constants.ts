import type { Category, Filters, NavItem, Priority, Role, Status } from '../types'

export const CATEGORIES: Category[] = [
  { key: 'plumbing', name: 'Plumbing', icon: 'droplet' },
  { key: 'electrical', name: 'Electrical', icon: 'zap' },
  { key: 'furniture', name: 'Furniture', icon: 'armchair' },
  { key: 'cleaning', name: 'Cleaning materials', icon: 'spray' },
  { key: 'wifi', name: 'Wi-Fi / Internet', icon: 'wifi' },
  { key: 'security', name: 'Security', icon: 'shield' },
  { key: 'heating', name: 'Heating / Cooling', icon: 'thermometer' },
  { key: 'damage', name: 'Building Damage', icon: 'building' },
  { key: 'water', name: 'Water Supply', icon: 'tap' },
  { key: 'lighting', name: 'Lighting', icon: 'bulb' },
  { key: 'other', name: 'Other', icon: 'dots' },
]

// Each category in everyday words: what the problem actually is. Used where the staff manager reads
// the mix of reports (Home page chart). Categories added later just show their own name.
export const CATEGORY_PLAIN: Record<string, string> = {
  plumbing: 'Leaking taps, pipes and toilets',
  electrical: 'Plugs, power and stoves not working',
  furniture: 'Broken beds, chairs and cupboards',
  cleaning: 'Cleaning supplies running out',
  wifi: 'Wi-Fi and internet down',
  security: 'Locks, gates and safety',
  heating: 'Heating or air-con not working',
  damage: 'Damaged walls, doors and windows',
  water: 'No water or no hot water',
  lighting: 'Lights and bulbs not working',
  other: 'Other problems',
}

// Keep historical category labels available while excluding these from report choices.
export const isReportableCategory = (category: Category) =>
  !['security', 'heating', 'cat-security', 'cat-hvac'].includes(category.key)

export const CATEGORY_ICONS = [
  'droplet', 'zap', 'armchair', 'spray', 'wifi', 'shield', 'thermometer',
  'building', 'tap', 'bulb', 'dots', 'flag', 'tools', 'layers',
]

export const BLOCKS = ['Block A', 'Block B', 'Block C', 'Block D', 'Block E', 'Block F']

// Places in a block that belong to nobody. Besides their own room, students can only pick these,
// so nobody reports a problem in another student's room. The server checks the same list.
export const SHARED_PLACES = ['Hallway', 'Laundry room', 'Study area', 'Elevator (Lift)', 'Stairs / entrance', 'Outside the block']

export const STATUSES: Status[] = ['Submitted', 'Received', 'Assigned', 'In Progress', 'Not Resolved', 'Resolved', 'Closed']

export const STATUS_CLASS: Record<Status, string> = {
  Submitted: 'status-submitted',
  Received: 'status-received',
  Assigned: 'status-assigned',
  'In Progress': 'status-inprogress',
  'Not Resolved': 'status-notresolved',
  Resolved: 'status-resolved',
  Closed: 'status-closed',
}

export const PRIORITIES: Priority[] = ['Low', 'Normal', 'High', 'Urgent']

// What each priority means, so students can pick the right one.
export const PRIORITY_HELP: Record<Priority, string> = {
  Low: 'Can wait — small or cosmetic',
  Normal: 'Annoying, but you can manage',
  High: 'Affects daily life or study',
  Urgent: 'Safety risk, flooding, no power',
}

export const PRIORITY_CLASS: Record<Priority, string> = {
  Low: 'priority-low',
  Normal: 'priority-normal',
  High: 'priority-high',
  Urgent: 'priority-urgent',
}

export const DONE_STATUSES: Status[] = ['Resolved', 'Closed']

// Which staff specialization handles each issue category. Anything not listed goes to general maintenance.
export const CATEGORY_SPECIALIZATION: Record<string, string> = {
  plumbing: 'Plumbing',
  water: 'Plumbing',
  electrical: 'Electrical',
  lighting: 'Electrical',
  wifi: 'IT / Wi-Fi',
}

export const GENERAL_SPECIALIZATION = 'General Maintenance'

// Jobs a maintenance staff member can be set up for.
export const SPECIALIZATIONS = ['Plumbing', 'Electrical', 'IT / Wi-Fi', GENERAL_SPECIALIZATION]

export const ROLE_NAMES: Record<Role, string> = {
  student: 'Student',
  admin: 'Staff Manager',
  maintenance: 'Maintenance Staff',
  sysadmin: 'System Administrator',
}

export const NAV: Record<Role, NavItem[]> = {
  student: [
    { key: 'overview', label: 'Home', icon: 'home' },
    { key: 'report', label: 'Report an Issue', icon: 'plus-circle' },
    { key: 'notifications', label: 'Notifications', icon: 'bell' },
  ],
  admin: [
    { key: 'overview', label: 'Home', icon: 'home' },
    { key: 'issues', label: 'All Issues', icon: 'list' },
    { key: 'parts', label: 'Parts Store', icon: 'box' },
    { key: 'reports', label: 'Reports', icon: 'file-text' },
  ],
  maintenance: [
    { key: 'assigned', label: 'Assigned to Me', icon: 'tools' },
    { key: 'completed', label: 'Completed', icon: 'check-circle' },
    { key: 'parts', label: 'Parts Store', icon: 'box' },
    { key: 'reports', label: 'My Reports', icon: 'file-text' },
  ],
  sysadmin: [
    { key: 'users', label: 'Users', icon: 'users' },
    { key: 'categories', label: 'Categories', icon: 'layers' },
    { key: 'settings', label: 'Settings', icon: 'settings' },
  ],
}

export const PAGE_TITLES: Record<Role, Record<string, string>> = {
  student: { overview: 'Home', report: 'Report an Issue', reports: 'My Reports', notifications: 'Notifications' },
  admin: { overview: 'Home', issues: 'All Issues', parts: 'Parts Store', reports: 'Reports' },
  maintenance: { assigned: 'Assigned to Me', completed: 'Completed Tasks', parts: 'Parts Store', reports: 'My Reports' },
  sysadmin: { users: 'Manage Users', categories: 'Manage Categories', settings: 'System Settings' },
}

export const DEFAULT_TABS: Record<Role, string> = {
  student: 'overview',
  admin: 'overview',
  maintenance: 'assigned',
  sysadmin: 'users',
}

// Quick views of the issue list. The dashboard stat tiles open the list on one of these.
export const ISSUE_VIEWS = [
  { key: 'all', label: 'All issues' },
  { key: 'open', label: 'Currently open' },
  { key: 'unassigned', label: 'Awaiting assignment' },
  { key: 'urgent', label: 'Urgent & open' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'reopened', label: 'Re-opened' },
  { key: 'done', label: 'Resolved / closed' },
]

// Follow-up is available after 24 elapsed hours, for every priority (same as the server).
export const OVERDUE_AFTER_DAYS: Record<Priority, number> = { Urgent: 1, High: 1, Normal: 1, Low: 1 }

export const DEFAULT_FILTERS: Filters = { view: 'all', status: 'all', category: 'all', residence: 'all', assignee: 'all', room: '', search: '' }
