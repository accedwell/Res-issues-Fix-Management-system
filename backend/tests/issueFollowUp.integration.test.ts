import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import type { Issue, Notification } from "../src/types.js";
import { isOverdue } from "../../frontend/resifix/src/utils.ts";

// Run only against an explicitly supplied, migrated disposable database.
const databaseUrl = process.env.RESIFIX_TEST_DATABASE_URL;

test("account domains and 24-hour follow-up API: validation, access rules, reminders and resend history", {
  skip: !databaseUrl, timeout: 90_000,
}, async () => {
  const database = new URL(databaseUrl!);
  assert.match(database.pathname, /^\/resifix_followup_test_[a-z0-9_]+$/);
  assert.ok(["127.0.0.1", "localhost"].includes(database.hostname), "Use a local disposable test database");
  process.env.DATABASE_URL = databaseUrl;
  process.env.TOKEN_SECRET = randomUUID() + randomUUID();
  const { default: prisma } = await import("../src/lib/prisma.js");
  const { hashPassword } = await import("../src/lib/security.js");
  const password = "FollowUpTest123!";
  const blockId = "followup-test-block";
  const categoryId = "followup-test-plumbing";
  const users = [
    { id: "followup-student", role: "STUDENT", email: "followup-student@resstudent.ac.za" },
    { id: "followup-other", role: "STUDENT", email: "followup-other@resstudent.ac.za" },
    { id: "followup-admin", role: "ADMIN", email: "followup-admin@resstaff.ac.za" },
    { id: "followup-staff", role: "MAINTENANCE", email: "followup-staff@resstaff.ac.za" },
    { id: "followup-system", role: "SYSADMIN", email: "followup-system@resstaff.ac.za" },
  ] as const;
  const port = process.env.RESIFIX_TEST_PORT ?? "5012";
  const base = `http://127.0.0.1:${port}/api`;
  let server: ReturnType<typeof spawn> | undefined;
  let logs = "";
  const issueIds: string[] = [];
  const addedUserIds: string[] = [];
  async function request<T>(path: string, token?: string, body?: unknown, method = body ? "POST" : "GET") {
    const response = await fetch(base + path, {
      method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, data: await response.json() as T };
  }
  async function login(email: string) {
    const result = await request<{ token: string }>("/auth/login", undefined, { email, password });
    assert.equal(result.status, 200);
    return result.data.token;
  }
  try {
    await prisma.residenceBlock.create({ data: { id: blockId, name: "Follow-up Test Block" } });
    await prisma.issueCategory.create({ data: { id: categoryId, name: "Follow-up Test Plumbing" } });
    for (const user of users) await prisma.user.create({ data: {
      ...user, fullName: user.id, passwordHash: hashPassword(password), blockId, roomNumber: "101",
    } });
    server = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      // AUTO_ASSIGN off: this test assigns reports itself, as a supervisor.
      env: { ...process.env, DATABASE_URL: databaseUrl, PORT: port, TOKEN_SECRET: process.env.TOKEN_SECRET, AUTO_ASSIGN: "off" },
      stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
    });
    server.stdout?.on("data", (data) => { logs += String(data); });
    server.stderr?.on("data", (data) => { logs += String(data); });
    for (let attempt = 0; ; attempt++) {
      try { if ((await fetch(base + "/health/db")).ok) break; } catch { /* wait for startup */ }
      assert.ok(attempt < 60, `Test server did not start: ${logs}`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const student = await login(users[0].email);
    const other = await login(users[1].email);
    const admin = await login(users[2].email);
    const staff = await login(users[3].email);
    const system = await login(users[4].email);

    const signup = { firstName: "Email", lastName: "Test", studentNumber: "EMAIL-TEST-1", block: "Follow-up Test Block", room: "102", password };
    const wrongSignup = await request<{ error: string }>("/auth/signup", undefined, { ...signup, email: "signup@resStaff.ac.za" });
    assert.equal(wrongSignup.status, 400);
    assert.match(wrongSignup.data.error, /resStudent\.ac\.za/);
    const validSignup = await request<{ user: { id: string; email: string } }>("/auth/signup", undefined, { ...signup, email: "Signup@resStudent.ac.za" });
    assert.equal(validSignup.status, 201);
    addedUserIds.push(validSignup.data.user.id);
    assert.equal(validSignup.data.user.email, "signup@resstudent.ac.za");
    const wrongStudent = await request("/users", system, { name: "Student Test", role: "student", email: "created-student@resStaff.ac.za", password });
    assert.equal(wrongStudent.status, 400);
    for (const role of ["admin", "maintenance", "sysadmin"]) {
      const wrongStaff = await request<{ error: string }>("/users", system, { name: "Staff Test", role, email: `created-${role}@resStudent.ac.za`, password });
      assert.equal(wrongStaff.status, 400);
      assert.match(wrongStaff.data.error, /resStaff\.ac\.za/);
      const validStaff = await request<{ user: { id: string; email: string } }>("/users", system, { name: "Staff Test", role, email: `Created-${role}@resStaff.ac.za`, password });
      assert.equal(validStaff.status, 201);
      addedUserIds.push(validStaff.data.user.id);
      assert.equal(validStaff.data.user.email, `created-${role}@resstaff.ac.za`);
    }
    const created = await request<{ issue: Issue }>("/issues", student, {
      title: "24-hour follow-up test", category: categoryId, priority: "Normal",
      residence: "Follow-up Test Block", room: "101", description: "The tap is leaking.",
    });
    assert.equal(created.status, 201);
    const report = created.data.issue;
    issueIds.push(report.id);
    assert.ok(Math.abs(Date.now() - Date.parse(report.reportedAt!)) < 5_000);
    assert.equal((await request(`/issues/${report.id}/not-fixed`, student, { reason: "Too early" })).status, 400);
    const notices = async () => (await request<{ notifications: Notification[] }>("/notifications", student)).data.notifications;
    const reminders = (rows: Notification[]) => rows.filter((n) => n.issueId === report.id && /not yet fixed after 24 hours/.test(n.message));
    assert.equal(reminders(await notices()).length, 0);

    const old = new Date(Date.now() - 49 * 60 * 60 * 1000);
    await prisma.maintenanceIssue.update({ where: { id: report.id }, data: { reportedAt: old } });
    await prisma.issueHistory.updateMany({ where: { issueId: report.id }, data: { createdAt: old } });
    const overdue = (await request<{ issue: Issue }>(`/issues/${report.id}`, student)).data.issue;
    assert.equal(isOverdue(overdue), true);
    for (const rows of await Promise.all([notices(), notices(), notices(), notices()])) assert.equal(reminders(rows).length, 1);
    assert.equal(reminders(await notices())[0].read, false);
    assert.equal((await request(`/issues/${report.id}/not-fixed`, other, { reason: "Not mine" })).status, 404);
    assert.equal((await request(`/issues/${report.id}/not-fixed`, staff, { reason: "Wrong role" })).status, 403);

    const resent = await request<{ issue: Issue }>(`/issues/${report.id}/not-fixed`, student, { reason: "Still waiting for a repair." });
    assert.equal(resent.status, 200);
    assert.equal(resent.data.issue.id, report.id);
    assert.equal(resent.data.issue.ref, report.ref);
    assert.equal(resent.data.issue.status, "Submitted");
    assert.equal(resent.data.issue.reopened, 1);
    assert.equal(isOverdue(resent.data.issue), false);
    assert.equal((await request(`/issues/${report.id}/not-fixed`, student, { reason: "Repeated too soon" })).status, 400);
    const followUp = await prisma.issueHistory.findFirstOrThrow({ where: { issueId: report.id, action: "REOPENED" } });
    assert.match(followUp.comment!, /Still waiting for a repair/);
    assert.ok(Math.abs(Date.now() - followUp.createdAt.getTime()) < 5_000);
    const adminNotices = (await request<{ notifications: Notification[] }>("/notifications", admin)).data.notifications;
    assert.ok(adminNotices.some((n) => n.issueId === report.id && /Re-opened/.test(n.message)));
    assert.equal(reminders(await notices()).length, 1);

    await prisma.issueHistory.update({ where: { id: followUp.id }, data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) } });
    for (const rows of await Promise.all([notices(), notices()])) assert.equal(reminders(rows).length, 2);
    for (const token of [student, other, staff, system]) {
      assert.equal((await request(`/issues/${report.id}/assign`, token, { staffId: users[3].id })).status, 403);
    }
    const assigned = await request<{ issue: Issue }>(`/issues/${report.id}/assign`, admin, { staffId: users[3].id });
    assert.equal(assigned.status, 200);
    assert.equal(assigned.data.issue.assignedTo, users[3].id);
    assert.equal(assigned.data.issue.status, "Assigned");
    assert.equal((await request(`/issues/${report.id}/not-fixed`, student, { reason: "Please attend to this report." })).status, 200);
    const staffNotices = (await request<{ notifications: Notification[] }>("/notifications", staff)).data.notifications;
    assert.ok(staffNotices.some((n) => n.issueId === report.id && /Re-opened/.test(n.message)));
    assert.equal((await request(`/issues/${report.id}/progress`, staff, { status: "Resolved", note: "Fixed." })).status, 200);
    assert.equal(reminders(await notices()).length, 2);
  } finally {
    if (server && server.exitCode === null) {
      const stopped = once(server, "exit"); server.kill(); await stopped;
    }
    await prisma.notification.deleteMany({ where: { issueId: { in: issueIds } } });
    await prisma.maintenanceIssue.deleteMany({ where: { id: { in: issueIds } } });
    await prisma.user.deleteMany({ where: { id: { in: [...users.map((user) => user.id), ...addedUserIds] } } });
    await prisma.issueCategory.deleteMany({ where: { id: categoryId } });
    await prisma.residenceBlock.deleteMany({ where: { id: blockId } });
    await prisma.$disconnect();
  }
});
