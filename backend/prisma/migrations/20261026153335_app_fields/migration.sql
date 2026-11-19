-- AlterEnum
ALTER TYPE "IssueStatus" ADD VALUE 'RECEIVED';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SYSADMIN';

-- AlterTable
ALTER TABLE "issue_categories" ADD COLUMN     "icon" TEXT NOT NULL DEFAULT 'dots';

-- AlterTable
ALTER TABLE "maintenance_issues" ADD COLUMN     "has_photo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reopen_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "specialization" TEXT;

-- CreateTable
CREATE TABLE "password_resets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_user_id_key" ON "password_resets"("user_id");

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
