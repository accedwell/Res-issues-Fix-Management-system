-- CreateTable
CREATE TABLE "duty_shifts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "clock_in_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clock_out_at" TIMESTAMP(3),
    "auto_closed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "duty_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "duty_shifts_user_id_clock_out_at_idx" ON "duty_shifts"("user_id", "clock_out_at");

-- CreateIndex
CREATE INDEX "duty_shifts_clock_in_at_idx" ON "duty_shifts"("clock_in_at");

-- AddForeignKey
ALTER TABLE "duty_shifts" ADD CONSTRAINT "duty_shifts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
