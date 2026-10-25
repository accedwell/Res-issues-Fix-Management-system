-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'MAINTENANCE', 'ADMIN');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('REPORTED', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "IssuePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ISSUE_CREATED', 'ISSUE_ASSIGNED', 'STATUS_UPDATED', 'COMMENT_ADDED', 'ISSUE_RESOLVED', 'ISSUE_CLOSED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "HistoryAction" AS ENUM ('CREATED', 'ASSIGNED', 'STATUS_CHANGED', 'PRIORITY_CHANGED', 'COMMENT_ADDED', 'RESOLVED', 'CLOSED', 'REOPENED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "student_number" TEXT,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
    "block_id" TEXT,
    "room_number" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "residence_blocks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "residence_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_issues" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "IssueStatus" NOT NULL DEFAULT 'REPORTED',
    "priority" "IssuePriority" NOT NULL DEFAULT 'MEDIUM',
    "reporter_id" TEXT NOT NULL,
    "assignee_id" TEXT,
    "category_id" TEXT NOT NULL,
    "block_id" TEXT NOT NULL,
    "room_number" TEXT,
    "location" TEXT,
    "image_url" TEXT,
    "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_history" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" "HistoryAction" NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "issue_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_feedback" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_student_number_key" ON "users"("student_number");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_block_id_idx" ON "users"("block_id");

-- CreateIndex
CREATE UNIQUE INDEX "residence_blocks_name_key" ON "residence_blocks"("name");

-- CreateIndex
CREATE UNIQUE INDEX "issue_categories_name_key" ON "issue_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_issues_reference_key" ON "maintenance_issues"("reference");

-- CreateIndex
CREATE INDEX "maintenance_issues_status_idx" ON "maintenance_issues"("status");

-- CreateIndex
CREATE INDEX "maintenance_issues_priority_idx" ON "maintenance_issues"("priority");

-- CreateIndex
CREATE INDEX "maintenance_issues_reporter_id_idx" ON "maintenance_issues"("reporter_id");

-- CreateIndex
CREATE INDEX "maintenance_issues_assignee_id_idx" ON "maintenance_issues"("assignee_id");

-- CreateIndex
CREATE INDEX "maintenance_issues_category_id_idx" ON "maintenance_issues"("category_id");

-- CreateIndex
CREATE INDEX "maintenance_issues_block_id_idx" ON "maintenance_issues"("block_id");

-- CreateIndex
CREATE INDEX "maintenance_issues_reported_at_idx" ON "maintenance_issues"("reported_at");

-- CreateIndex
CREATE INDEX "maintenance_issues_status_priority_idx" ON "maintenance_issues"("status", "priority");

-- CreateIndex
CREATE INDEX "issue_history_issue_id_created_at_idx" ON "issue_history"("issue_id", "created_at");

-- CreateIndex
CREATE INDEX "issue_history_user_id_idx" ON "issue_history"("user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "notifications_issue_id_idx" ON "notifications"("issue_id");

-- CreateIndex
CREATE UNIQUE INDEX "issue_feedback_issue_id_key" ON "issue_feedback"("issue_id");

-- CreateIndex
CREATE INDEX "issue_feedback_user_id_idx" ON "issue_feedback"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "residence_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_issues" ADD CONSTRAINT "maintenance_issues_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_issues" ADD CONSTRAINT "maintenance_issues_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_issues" ADD CONSTRAINT "maintenance_issues_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "issue_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_issues" ADD CONSTRAINT "maintenance_issues_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "residence_blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_history" ADD CONSTRAINT "issue_history_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "maintenance_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_history" ADD CONSTRAINT "issue_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_feedback" ADD CONSTRAINT "issue_feedback_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "maintenance_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_feedback" ADD CONSTRAINT "issue_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
