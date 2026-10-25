import { hashPassword } from "../lib/security.js";
import type { Data, User } from "../types.js";

// Every sample account uses this password so the app can be tried straight away.
export const DEMO_PASSWORD = "password123";

const created = "2026-08-01";

function user(fields: Omit<User, "passwordHash" | "createdAt">): User {
  return { ...fields, passwordHash: hashPassword(DEMO_PASSWORD), createdAt: created };
}

export function createSeedData(): Data {
  return {
    users: [
      user({ id: "stu-1", name: "Naledi Mahlangu", email: "naledi.m@campus.ac.za", role: "student", studentNumber: "22045678", block: "Block A", room: "204" }),
      user({ id: "stu-2", name: "Karabo Sithole", email: "karabo.s@campus.ac.za", role: "student", studentNumber: "22051234", block: "Block C", room: "12" }),
      user({ id: "adm-1", name: "Palesa Mokgadi", email: "p.mokgadi@campus.ac.za", role: "admin" }),
      user({ id: "stf-1", name: "Thabo Nkosi", email: "t.nkosi@campus.ac.za", role: "maintenance", specialization: "Plumbing" }),
      user({ id: "stf-2", name: "Lindiwe Mokoena", email: "l.mokoena@campus.ac.za", role: "maintenance", specialization: "Electrical" }),
      user({ id: "stf-3", name: "Sipho Dlamini", email: "s.dlamini@campus.ac.za", role: "maintenance", specialization: "General Maintenance" }),
      user({ id: "stf-4", name: "Ayanda Khumalo", email: "a.khumalo@campus.ac.za", role: "maintenance", specialization: "IT / Wi-Fi" }),
      user({ id: "sys-1", name: "System Administrator", email: "sysadmin@campus.ac.za", role: "sysadmin" }),
    ],

    issues: [
      {
        id: "i-1", ref: "ISS-2026-00125", title: "Broken bathroom tap", category: "plumbing",
        description: "The bathroom tap has been leaking continuously since yesterday.",
        residence: "Block A", room: "204", priority: "Normal", status: "In Progress",
        studentId: "stu-1", studentName: "Naledi Mahlangu", assignedTo: "stf-1", dateReported: "2026-09-20", photo: true,
        history: [
          { status: "Submitted", date: "2026-09-20", note: "Report submitted by student." },
          { status: "Received", date: "2026-09-20", note: "Reviewed by residence administrator." },
          { status: "Assigned", date: "2026-09-21", note: "Assigned to Thabo Nkosi (Plumbing)." },
          { status: "In Progress", date: "2026-09-22", note: "Technician on site, replacement part ordered." },
        ],
        feedback: null, reopened: 0,
      },
      {
        id: "i-2", ref: "ISS-2026-00126", title: "Wi-Fi not connecting in room", category: "wifi",
        description: "Unable to connect to residence Wi-Fi since Monday morning.",
        residence: "Block A", room: "118", priority: "High", status: "Assigned",
        studentId: "stu-1", studentName: "Naledi Mahlangu", assignedTo: "stf-4", dateReported: "2026-09-24", photo: false,
        history: [
          { status: "Submitted", date: "2026-09-24", note: "Report submitted by student." },
          { status: "Received", date: "2026-09-24", note: "Reviewed by residence administrator." },
          { status: "Assigned", date: "2026-09-25", note: "Assigned to Ayanda Khumalo (IT / Wi-Fi)." },
        ],
        feedback: null, reopened: 0,
      },
      {
        id: "i-3", ref: "ISS-2026-00119", title: "Broken chair in common room", category: "furniture",
        description: "One of the study chairs in the common room has a broken leg.",
        residence: "Block B", room: "Common Room", priority: "Low", status: "Resolved",
        studentId: "stu-1", studentName: "Naledi Mahlangu", assignedTo: "stf-3", dateReported: "2026-09-10", photo: true,
        history: [
          { status: "Submitted", date: "2026-09-10", note: "Report submitted by student." },
          { status: "Received", date: "2026-09-10", note: "Reviewed by residence administrator." },
          { status: "Assigned", date: "2026-09-11", note: "Assigned to Sipho Dlamini." },
          { status: "In Progress", date: "2026-09-12", note: "Chair collected for repair." },
          { status: "Resolved", date: "2026-09-14", note: "Chair repaired and returned to common room." },
        ],
        feedback: null, reopened: 0,
      },
      {
        id: "i-4", ref: "ISS-2026-00101", title: "Flickering hallway light", category: "lighting",
        description: "The light outside room 210 flickers constantly at night.",
        residence: "Block A", room: "Hallway 2nd floor", priority: "Normal", status: "Closed",
        studentId: "stu-1", studentName: "Naledi Mahlangu", assignedTo: "stf-2", dateReported: "2026-08-29", photo: false,
        history: [
          { status: "Submitted", date: "2026-08-29", note: "Report submitted by student." },
          { status: "Received", date: "2026-08-29", note: "Reviewed by residence administrator." },
          { status: "Assigned", date: "2026-08-30", note: "Assigned to Lindiwe Mokoena." },
          { status: "In Progress", date: "2026-08-31", note: "Faulty ballast identified." },
          { status: "Resolved", date: "2026-09-01", note: "Light fitting replaced." },
          { status: "Closed", date: "2026-09-02", note: "Student confirmed resolution." },
        ],
        feedback: { rating: 5, comment: "Fixed quickly, thank you!" }, reopened: 0,
      },
      {
        id: "i-5", ref: "ISS-2026-00131", title: "Security gate not locking", category: "security",
        description: "The side security gate near Block C does not latch shut properly.",
        residence: "Block C", room: "Side entrance", priority: "Urgent", status: "Received",
        studentId: "stu-2", studentName: "Karabo Sithole", assignedTo: null, dateReported: "2026-09-27", photo: true,
        history: [
          { status: "Submitted", date: "2026-09-27", note: "Report submitted by student." },
          { status: "Received", date: "2026-09-27", note: "Reviewed by residence administrator — flagged urgent." },
        ],
        feedback: null, reopened: 0,
      },
      {
        id: "i-6", ref: "ISS-2026-00132", title: "No hot water in showers", category: "water",
        description: "Showers on the 3rd floor have had no hot water since this morning.",
        residence: "Block B", room: "3rd floor bathroom", priority: "High", status: "Submitted",
        studentId: "stu-2", studentName: "Karabo Sithole", assignedTo: null, dateReported: "2026-09-29", photo: false,
        history: [{ status: "Submitted", date: "2026-09-29", note: "Report submitted by student." }],
        feedback: null, reopened: 0,
      },
    ],

    notifications: [
      { id: "n-1", userId: "stu-1", message: "Your report ISS-2026-00125 is now In Progress.", date: "2026-09-22", read: false },
      { id: "n-2", userId: "stu-1", message: "ISS-2026-00126 has been assigned to Ayanda Khumalo.", date: "2026-09-25", read: false },
      { id: "n-3", userId: "stu-1", message: "ISS-2026-00119 has been marked Resolved — please confirm.", date: "2026-09-14", read: true },
      { id: "n-4", userId: "stu-1", message: "ISS-2026-00101 was received.", date: "2026-08-29", read: true },
    ],

    // "other" must stay last — it is the fallback category.
    categories: [
      { key: "plumbing", name: "Plumbing", icon: "droplet" },
      { key: "electrical", name: "Electrical", icon: "zap" },
      { key: "furniture", name: "Furniture", icon: "armchair" },
      { key: "cleaning", name: "Cleaning", icon: "spray" },
      { key: "wifi", name: "Wi-Fi / Internet", icon: "wifi" },
      { key: "security", name: "Security", icon: "shield" },
      { key: "heating", name: "Heating / Cooling", icon: "thermometer" },
      { key: "damage", name: "Building Damage", icon: "building" },
      { key: "water", name: "Water Supply", icon: "tap" },
      { key: "lighting", name: "Lighting", icon: "bulb" },
      { key: "other", name: "Other", icon: "dots" },
    ],

    settings: [
      { key: "edit", label: "Allow students to edit submitted reports", on: false },
      { key: "notify", label: "Auto-notify students on every status change", on: true },
      { key: "photo", label: "Require photo evidence on resolution", on: true },
      { key: "escalate", label: "Enable urgent priority escalation email", on: false },
    ],

    blocks: ["Block A", "Block B", "Block C", "Block D", "Block E", "Block F"],

    nextIssueNumber: 133,
  };
}
