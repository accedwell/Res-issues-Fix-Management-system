import type { Category, Filters, NavItem, Priority, Role, Status } from '../types'

export const CATEGORIES: Category[] = [
  { key: 'plumbing', name: 'Plumbing', icon: 'droplet' },
  { key: 'electrical', name: 'Electrical', icon: 'zap' },
  { key: 'furniture', name: 'Furniture', icon: 'armchair' },
  { key: 'cleaning', name: 'Cleaning', icon: 'spray' },
  { key: 'wifi', name: 'Wi-Fi / Internet', icon: 'wifi' },
  { key: 'security', name: 'Security', icon: 'shield' },
  { key: 'heating', name: 'Heating / Cooling', icon: 'thermometer' },
  { key: 'damage', name: 'Building Damage', icon: 'building' },
  { key: 'water', name: 'Water Supply', icon: 'tap' },
  { key: 'lighting', name: 'Lighting', icon: 'bulb' },
  { key: 'other', name: 'Other', icon: 'dots' },
]

export const CATEGORY_ICONS = [
  'droplet', 'zap', 'armchair', 'spray', 'wifi', 'shield', 'thermometer',
  'building', 'tap', 'bulb', 'dots', 'flag', 'tools', 'layers',
]

export const BLOCKS = ['Block A', 'Block B', 'Block C', 'Block D', 'Block E', 'Block F']

export const STATUSES: Status[] = ['Submitted', 'Received', 'Assigned', 'In Progress', 'Resolved', 'Closed']

export const STATUS_CLASS: Record<Status, string> = {
  Submitted: 'status-submitted',
  Received: 'status-received',
  Assigned: 'status-assigned',
  'In Progress': 'status-inprogress',
  Resolved: 'status-resolved',
  Closed: 'status-closed',
}

export const PRIORITIES: Priority[] = ['Low', 'Normal', 'High', 'Urgent']

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
  admin: 'Residence Administrator',
  maintenance: 'Maintenance Staff',
  sysadmin: 'System Administrator',
}

export const NAV: Record<Role, NavItem[]> = {
  student: [
    { key: 'overview', label: 'Overview', icon: 'home' },
    { key: 'report', label: 'Report an Issue', icon: 'plus-circle' },
    { key: 'reports', label: 'My Reports', icon: 'list' },
    { key: 'notifications', label: 'Notifications', icon: 'bell' },
  ],
  admin: [
    { key: 'overview', label: 'Overview', icon: 'home' },
    { key: 'issues', label: 'All Issues', icon: 'list' },
    { key: 'reports', label: 'Reports', icon: 'file-text' },
  ],
  maintenance: [
    { key: 'assigned', label: 'Assigned to Me', icon: 'tools' },
    { key: 'completed', label: 'Completed', icon: 'check-circle' },
  ],
  sysadmin: [
    { key: 'users', label: 'Users', icon: 'users' },
    { key: 'categories', label: 'Categories', icon: 'layers' },
    { key: 'settings', label: 'Settings', icon: 'settings' },
  ],
}

export const PAGE_TITLES: Record<Role, Record<string, string>> = {
  student: { overview: 'Overview', report: 'Report an Issue', reports: 'My Reports', notifications: 'Notifications' },
  admin: { overview: 'Overview', issues: 'All Issues', reports: 'Reports' },
  maintenance: { assigned: 'Assigned to Me', completed: 'Completed Tasks' },
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
  { key: 'done', label: 'Resolved / closed' },
]

export const DEFAULT_FILTERS: Filters = { view: 'all', status: 'all', category: 'all', residence: 'all', search: '' }
