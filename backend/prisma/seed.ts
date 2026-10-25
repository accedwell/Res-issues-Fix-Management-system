
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing from backend/.env");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("ResiFixDemo123!", 12);

  // Six residence blocks.
  const blocks = [
    { id: "block-a", name: "Block A" },
    { id: "block-b", name: "Block B" },
    { id: "block-c", name: "Block C" },
    { id: "block-d", name: "Block D" },
    { id: "block-e", name: "Block E" },
    { id: "block-f", name: "Block F" },
  ];

  for (const block of blocks) {
    await prisma.residenceBlock.upsert({
      where: { id: block.id },
      update: { name: block.name, isActive: true },
      create: block,
    });
  }

  // Keep Other last in the category list.
  const categories = [
    { id: "cat-plumbing", name: "Plumbing" },
    { id: "cat-electrical", name: "Electrical" },
    { id: "cat-cleaning", name: "Cleaning" },
    { id: "cat-carpentry", name: "Carpentry" },
    { id: "cat-painting", name: "Painting" },
    { id: "cat-hvac", name: "Heating and Ventilation" },
    { id: "cat-pest", name: "Pest Control" },
    { id: "cat-security", name: "Security" },
    { id: "cat-network", name: "Internet and Network" },
    { id: "cat-furniture", name: "Furniture" },
    { id: "cat-other", name: "Other" },
  ];

  for (const category of categories) {
    await prisma.issueCategory.upsert({
      where: { id: category.id },
      update: { name: category.name, isActive: true },
      create: category,
    });
  }

  // Five demo accounts.
  const users = [
    {
      id: "user-admin",
      fullName: "ResiFix Administrator",
      email: "admin@resifix.local",
      role: "ADMIN" as const,
      studentNumber: null,
      blockId: null,
      roomNumber: null,
    },
    {
      id: "user-maintenance-1",
      fullName: "Thabo Maintenance",
      email: "maintenance1@resifix.local",
      role: "MAINTENANCE" as const,
      studentNumber: null,
      blockId: null,
      roomNumber: null,
    },
    {
      id: "user-maintenance-2",
      fullName: "Lerato Maintenance",
      email: "maintenance2@resifix.local",
      role: "MAINTENANCE" as const,
      studentNumber: null,
      blockId: null,
      roomNumber: null,
    },
    {
      id: "user-student-1",
      fullName: "Student One",
      email: "student1@resifix.local",
      role: "STUDENT" as const,
      studentNumber: "RF2026001",
      blockId: "block-a",
      roomNumber: "A101",
    },
    {
      id: "user-student-2",
      fullName: "Student Two",
      email: "student2@resifix.local",
      role: "STUDENT" as const,
      studentNumber: "RF2026002",
      blockId: "block-b",
      roomNumber: "B204",
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        fullName: user.fullName,
        passwordHash,
        role: user.role,
        studentNumber: user.studentNumber,
        blockId: user.blockId,
        roomNumber: user.roomNumber,
        isActive: true,
      },
      create: {
        ...user,
        passwordHash,
      },
    });
  }

  const issueDefinitions = [
    {
      id: "issue-0001",
      reference: "RFX-2026-0001",
      title: "Leaking bathroom tap",
      description: "The bathroom tap continues leaking after it is closed.",
      status: "REPORTED" as const,
      priority: "MEDIUM" as const,
      reporterId: "user-student-1",
      assigneeId: null,
      categoryId: "cat-plumbing",
      blockId: "block-a",
      roomNumber: "A101",
    },
    {
      id: "issue-0002",
      reference: "RFX-2026-0002",
      title: "Faulty bedroom light",
      description: "The main bedroom light is not working.",
      status: "ASSIGNED" as const,
      priority: "HIGH" as const,
      reporterId: "user-student-2",
      assigneeId: "user-maintenance-1",
      categoryId: "cat-electrical",
      blockId: "block-b",
      roomNumber: "B204",
    },
    {
      id: "issue-0003",
      reference: "RFX-2026-0003",
      title: "Damaged wardrobe door",
      description: "The wardrobe door hinge has come loose.",
      status: "IN_PROGRESS" as const,
      priority: "LOW" as const,
      reporterId: "user-student-1",
      assigneeId: "user-maintenance-1",
      categoryId: "cat-carpentry",
      blockId: "block-a",
      roomNumber: "A101",
    },
    {
      id: "issue-0004",
      reference: "RFX-2026-0004",
      title: "Pest control required",
      description: "Ants have appeared near the shared kitchen.",
      status: "ON_HOLD" as const,
      priority: "MEDIUM" as const,
      reporterId: "user-student-2",
      assigneeId: "user-maintenance-2",
      categoryId: "cat-pest",
      blockId: "block-b",
      roomNumber: "B204",
    },
    {
      id: "issue-0005",
      reference: "RFX-2026-0005",
      title: "Damaged corridor wall",
      description: "A section of corridor paint has peeled off.",
      status: "RESOLVED" as const,
      priority: "LOW" as const,
      reporterId: "user-student-1",
      assigneeId: "user-maintenance-2",
      categoryId: "cat-painting",
      blockId: "block-c",
      roomNumber: null,
    },
    {
      id: "issue-0006",
      reference: "RFX-2026-0006",
      title: "Broken desk",
      description: "The study desk has a broken support leg.",
      status: "CLOSED" as const,
      priority: "HIGH" as const,
      reporterId: "user-student-2",
      assigneeId: "user-maintenance-1",
      categoryId: "cat-furniture",
      blockId: "block-b",
      roomNumber: "B204",
    },
  ];

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  for (let index = 0; index < issueDefinitions.length; index++) {
    const issue = issueDefinitions[index];
    const assigned = issue.assigneeId !== null;
    const resolved =
      issue.status === "RESOLVED" || issue.status === "CLOSED";
    const closed = issue.status === "CLOSED";

    await prisma.maintenanceIssue.upsert({
      where: { reference: issue.reference },
      update: {
        title: issue.title,
        description: issue.description,
        status: issue.status,
        priority: issue.priority,
        reporterId: issue.reporterId,
        assigneeId: issue.assigneeId,
        categoryId: issue.categoryId,
        blockId: issue.blockId,
        roomNumber: issue.roomNumber,
        assignedAt: assigned ? yesterday : null,
        startedAt: issue.status === "IN_PROGRESS" ? now : null,
        resolvedAt: resolved ? yesterday : null,
        closedAt: closed ? now : null,
      },
      create: {
        ...issue,
        assignedAt: assigned ? yesterday : null,
        startedAt: issue.status === "IN_PROGRESS" ? now : null,
        resolvedAt: resolved ? yesterday : null,
        closedAt: closed ? now : null,
        location: issue.roomNumber
          ? `Room ${issue.roomNumber}`
          : "Shared residence area",
      },
    });

    // Rebuild history for these six seeded issues on each run.
    await prisma.issueHistory.deleteMany({
      where: { issueId: issue.id },
    });

    await prisma.issueHistory.create({
      data: {
        issueId: issue.id,
        userId: issue.reporterId,
        action: "CREATED",
        newValue: "REPORTED",
        comment: "Maintenance issue reported.",
        createdAt: twoDaysAgo,
      },
    });

    if (issue.status !== "REPORTED") {
      await prisma.issueHistory.create({
        data: {
          issueId: issue.id,
          userId: issue.assigneeId ?? "user-admin",
          action: "STATUS_CHANGED",
          oldValue: "REPORTED",
          newValue: issue.status,
          comment: `Issue status set to ${issue.status}.`,
          createdAt: yesterday,
        },
      });
    }

    if (issue.status === "CLOSED") {
      await prisma.issueFeedback.upsert({
        where: { issueId: issue.id },
        update: {
          userId: issue.reporterId,
          rating: 5,
          comment: "The issue was resolved satisfactorily.",
        },
        create: {
          issueId: issue.id,
          userId: issue.reporterId,
          rating: 5,
          comment: "The issue was resolved satisfactorily.",
        },
      });
    }
  }

  // Exactly four demo notifications; remove previous copies first.
  const notificationTitles = [
    "Issue reported successfully",
    "New issue assigned to you",
    "Maintenance in progress",
    "Issue resolved",
  ];

  await prisma.notification.deleteMany({
    where: { title: { in: notificationTitles } },
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: "user-student-1",
        type: "ISSUE_CREATED",
        title: notificationTitles[0],
        message: "Your leaking bathroom tap report has been recorded.",
        issueId: "issue-0001",
      },
      {
        userId: "user-maintenance-1",
        type: "ISSUE_ASSIGNED",
        title: notificationTitles[1],
        message: "You have been assigned a faulty bedroom light report.",
        issueId: "issue-0002",
      },
      {
        userId: "user-student-1",
        type: "STATUS_UPDATED",
        title: notificationTitles[2],
        message: "Work has started on your wardrobe door report.",
        issueId: "issue-0003",
      },
      {
        userId: "user-student-1",
        type: "ISSUE_RESOLVED",
        title: notificationTitles[3],
        message: "The damaged corridor wall report has been resolved.",
        issueId: "issue-0005",
      },
    ],
  });

  // Four configurable system settings.
  const settings = [
    {
      key: "app_name",
      value: "ResiFix",
      description: "Application display name",
    },
    {
      key: "maintenance_email",
      value: "maintenance@resifix.local",
      description: "Default maintenance contact",
    },
    {
      key: "allow_student_feedback",
      value: "true",
      description: "Allow feedback on completed issues",
    },
    {
      key: "default_issue_priority",
      value: "MEDIUM",
      description: "Default priority for new reports",
    },
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {
        value: setting.value,
        description: setting.description,
      },
      create: setting,
    });
  }

  console.log("ResiFix seed completed.");
  console.log("Demo users:", users.length);
  console.log("Issue categories:", categories.length);
  console.log("Residence blocks:", blocks.length);
  console.log("Maintenance issues:", issueDefinitions.length);
  console.log("Notifications:", notificationTitles.length);
  console.log("System settings:", settings.length);
}

main()
  .catch((error) => {
    console.error("ResiFix seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
