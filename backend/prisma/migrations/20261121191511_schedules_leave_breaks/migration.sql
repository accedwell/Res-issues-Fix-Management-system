-- AlterTable
ALTER TABLE "duty_shifts" ADD COLUMN     "break_minutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "break_started_at" TIMESTAMP(3),
ADD COLUMN     "break_until" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "staff_schedules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "days" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_leave" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "start_date" TEXT NOT NULL,
    "end_date" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_leave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_schedules_user_id_key" ON "staff_schedules"("user_id");

-- CreateIndex
CREATE INDEX "staff_leave_user_id_start_date_idx" ON "staff_leave"("user_id", "start_date");

-- AddForeignKey
ALTER TABLE "staff_schedules" ADD CONSTRAINT "staff_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_leave" ADD CONSTRAINT "staff_leave_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
