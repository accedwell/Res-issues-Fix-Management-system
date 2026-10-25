import type { Category, NavItem, Priority, Role, Staff, Status } from '../types'

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

export const STAFF: Staff[] = [
  { id: 'stf-1', name: 'Thabo Nkosi', specialization: 'Plumbing' },
  { id: 'stf-2', name: 'Lindiwe Mokoena', specialization: 'Electrical' },
  { id: 'stf-3', name: 'Sipho Dlamini', specialization: 'General Maintenance' },
  { id: 'stf-4', name: 'Ayanda Khumalo', specialization: 'IT / Wi-Fi' },
]

// Which staff specialization handles each issue category. Anything not listed goes to general maintenance.
export const CATEGORY_SPECIALIZATION: Record<string, string> = {
  plumbing: 'Plumbing',
  water: 'Plumbing',
  electrical: 'Electrical',
  lighting: 'Electrical',
  wifi: 'IT / Wi-Fi',
}

export const GENERAL_SPECIALIZATION = 'General Maintenance'

export const ROLE_NAMES: Record<Role, string> = {
  student: 'Student',
  admin: 'Residence Administrator',
  maintenance: 'Maintenance Staff',
  sysadmin: 'System Administrator',
}

export const USER_ROLES = ['Student', 'Residence Administrator', 'Maintenance Staff', 'System Administrator']

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
