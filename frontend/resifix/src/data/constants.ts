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

export const CATEGORY_ICONS = [
  'droplet', 'zap', 'armchair', 'spray', 'wifi', 'shield', 'thermometer',
  'building', 'tap', 'bulb', 'dots', 'flag', 'tools', 'layers',
]

export const BLOCKS = ['Block A', 'Block B', 'Block C', 'Block D', 'Block E', 'Block F']

// Places in a block that belong to nobody. Besides their own room, students can only pick these,
// so nobody reports a problem in another student's room. The server checks the same list.
export const SHARED_PLACES = ['Hallway', 'Bathroom', 'Kitchen', 'Common room', 'Laundry room', 'Stairs / entrance', 'Outside the block']

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
    { key: 'overview', label: 'Home', icon: 'home' },
    { key: 'report', label: 'Report an Issue', icon: 'plus-circle' },
    { key: 'notifications', label: 'Notifications', icon: 'bell' },
  ],
  admin: [
    { key: 'overview', label: 'Home', icon: 'home' },
    { key: 'issues', label: 'All Issues', icon: 'list' },
    { key: 'reports', label: 'Reports', icon: 'file-text' },
  ],
  maintenance: [
    { key: 'assigned', label: 'Assigned to Me', icon: 'tools' },
    { key: 'completed', label: 'Completed', icon: 'check-circle' },
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
  admin: { overview: 'Home', issues: 'All Issues', reports: 'Reports' },
  maintenance: { assigned: 'Assigned to Me', completed: 'Completed Tasks', reports: 'My Reports' },
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

// Every report, whatever its priority, is overdue once it is still open after 2 days (same as the server).
export const OVERDUE_AFTER_DAYS: Record<Priority, number> = { Urgent: 2, High: 2, Normal: 2, Low: 2 }

export const DEFAULT_FILTERS: Filters = { view: 'all', status: 'all', category: 'all', residence: 'all', assignee: 'all', room: '', search: '' }
