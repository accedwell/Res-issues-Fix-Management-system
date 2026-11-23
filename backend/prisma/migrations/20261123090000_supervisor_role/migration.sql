-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUPERVISOR';

-- AlterTable
ALTER TABLE "duty_shifts" ADD COLUMN     "clocked_in_by" TEXT,
ADD COLUMN     "clocked_out_by" TEXT;
