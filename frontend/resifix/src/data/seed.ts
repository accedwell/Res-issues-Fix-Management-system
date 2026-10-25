import type { AppNotification, Issue, Setting, User } from '../types'

// Sample data shown until the frontend is connected to the backend.

export const SEED_ISSUES: Issue[] = [
  {
    id: 'i-1', ref: 'ISS-2026-00125', title: 'Broken bathroom tap', category: 'plumbing',
    description: 'The bathroom tap has been leaking continuously since yesterday.',
    residence: 'Block A', room: '204', priority: 'Normal', status: 'In Progress',
    studentName: 'Naledi Mahlangu', studentId: 'stu-1', assignedTo: 'stf-1', dateReported: '2026-09-20', photo: true,
    history: [
      { status: 'Submitted', date: '2026-09-20', note: 'Report submitted by student.' },
      { status: 'Received', date: '2026-09-20', note: 'Reviewed by residence administrator.' },
      { status: 'Assigned', date: '2026-09-21', note: 'Assigned to Thabo Nkosi (Plumbing).' },
      { status: 'In Progress', date: '2026-09-22', note: 'Technician on site, replacement part ordered.' },
    ],
    feedback: null,
  },
  {
    id: 'i-2', ref: 'ISS-2026-00126', title: 'Wi-Fi not connecting in room', category: 'wifi',
    description: 'Unable to connect to residence Wi-Fi since Monday morning.',
    residence: 'Block A', room: '118', priority: 'High', status: 'Assigned',
    studentName: 'Naledi Mahlangu', studentId: 'stu-1', assignedTo: 'stf-4', dateReported: '2026-09-24', photo: false,
    history: [
      { status: 'Submitted', date: '2026-09-24', note: 'Report submitted by student.' },
      { status: 'Received', date: '2026-09-24', note: 'Reviewed by residence administrator.' },
      { status: 'Assigned', date: '2026-09-25', note: 'Assigned to Ayanda Khumalo (IT / Wi-Fi).' },
    ],
    feedback: null,
  },
  {
    id: 'i-3', ref: 'ISS-2026-00119', title: 'Broken chair in common room', category: 'furniture',
    description: 'One of the study chairs in the common room has a broken leg.',
    residence: 'Block B', room: 'Common Room', priority: 'Low', status: 'Resolved',
    studentName: 'Naledi Mahlangu', studentId: 'stu-1', assignedTo: 'stf-3', dateReported: '2026-09-10', photo: true,
    history: [
      { status: 'Submitted', date: '2026-09-10', note: 'Report submitted by student.' },
      { status: 'Received', date: '2026-09-10', note: 'Reviewed by residence administrator.' },
      { status: 'Assigned', date: '2026-09-11', note: 'Assigned to Sipho Dlamini.' },
      { status: 'In Progress', date: '2026-09-12', note: 'Chair collected for repair.' },
      { status: 'Resolved', date: '2026-09-14', note: 'Chair repaired and returned to common room.' },
    ],
    feedback: null,
  },
  {
    id: 'i-4', ref: 'ISS-2026-00101', title: 'Flickering hallway light', category: 'lighting',
    description: 'The light outside room 210 flickers constantly at night.',
    residence: 'Block A', room: 'Hallway 2nd floor', priority: 'Normal', status: 'Closed',
    studentName: 'Naledi Mahlangu', studentId: 'stu-1', assignedTo: 'stf-2', dateReported: '2026-08-29', photo: false,
    history: [
      { status: 'Submitted', date: '2026-08-29', note: 'Report submitted by student.' },
      { status: 'Received', date: '2026-08-29', note: 'Reviewed by residence administrator.' },
      { status: 'Assigned', date: '2026-08-30', note: 'Assigned to Lindiwe Mokoena.' },
      { status: 'In Progress', date: '2026-08-31', note: 'Faulty ballast identified.' },
      { status: 'Resolved', date: '2026-09-01', note: 'Light fitting replaced.' },
      { status: 'Closed', date: '2026-09-02', note: 'Student confirmed resolution.' },
    ],
    feedback: { rating: 5, comment: 'Fixed quickly, thank you!' },
  },
  {
    id: 'i-5', ref: 'ISS-2026-00131', title: 'Security gate not locking', category: 'security',
    description: 'The side security gate near Block C does not latch shut properly.',
    residence: 'Block C', room: 'Side entrance', priority: 'Urgent', status: 'Received',
    studentName: 'Karabo Sithole', studentId: 'stu-2', assignedTo: null, dateReported: '2026-09-27', photo: true,
    history: [
      { status: 'Submitted', date: '2026-09-27', note: 'Report submitted by student.' },
      { status: 'Received', date: '2026-09-27', note: 'Reviewed by residence administrator — flagged urgent.' },
    ],
    feedback: null,
  },
  {
    id: 'i-6', ref: 'ISS-2026-00132', title: 'No hot water in showers', category: 'water',
    description: 'Showers on the 3rd floor have had no hot water since this morning.',
    residence: 'Block B', room: '3rd floor bathroom', priority: 'High', status: 'Submitted',
    studentName: 'Karabo Sithole', studentId: 'stu-2', assignedTo: null, dateReported: '2026-09-29', photo: false,
    history: [
      { status: 'Submitted', date: '2026-09-29', note: 'Report submitted by student.' },
    ],
    feedback: null,
  },
]

export const SEED_NOTIFICATIONS: AppNotification[] = [
  { id: 'n-1', studentId: 'stu-1', message: 'Your report ISS-2026-00125 is now In Progress.', date: '2026-09-22', read: false },
  { id: 'n-2', studentId: 'stu-1', message: 'ISS-2026-00126 has been assigned to Ayanda Khumalo.', date: '2026-09-25', read: false },
  { id: 'n-3', studentId: 'stu-1', message: 'ISS-2026-00119 has been marked Resolved — please confirm.', date: '2026-09-14', read: true },
  { id: 'n-4', studentId: 'stu-1', message: 'ISS-2026-00101 was received.', date: '2026-08-29', read: true },
]

export const SEED_USERS: User[] = [
  { id: 'u-1', name: 'Naledi Mahlangu', role: 'Student', email: 'naledi.m@campus.ac.za', extra: 'Block A · Room 204' },
  { id: 'u-2', name: 'Karabo Sithole', role: 'Student', email: 'karabo.s@campus.ac.za', extra: 'Block C · Room 12' },
  { id: 'u-3', name: 'Palesa Mokgadi', role: 'Residence Administrator', email: 'p.mokgadi@campus.ac.za', extra: 'Block A & B' },
  { id: 'u-4', name: 'Thabo Nkosi', role: 'Maintenance Staff', email: 't.nkosi@campus.ac.za', extra: 'Plumbing' },
  { id: 'u-5', name: 'Lindiwe Mokoena', role: 'Maintenance Staff', email: 'l.mokoena@campus.ac.za', extra: 'Electrical' },
]

export const SEED_SETTINGS: Setting[] = [
  { key: 'edit', label: 'Allow students to edit submitted reports', on: false },
  { key: 'notify', label: 'Auto-notify students on every status change', on: true },
  { key: 'photo', label: 'Require photo evidence on resolution', on: true },
  { key: 'escalate', label: 'Enable urgent priority escalation email', on: false },
]
