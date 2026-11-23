-- AlterTable
ALTER TABLE "maintenance_issues" ADD COLUMN     "accepted_at" TIMESTAMP(3);

-- Jobs that were already assigned before accepting existed count as accepted, so nobody is alerted about them.
UPDATE "maintenance_issues" SET "accepted_at" = COALESCE("assigned_at", "updated_at") WHERE "assignee_id" IS NOT NULL;
