-- CreateTable
CREATE TABLE "issue_messages" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "issue_messages_issue_id_created_at_idx" ON "issue_messages"("issue_id", "created_at");

-- AddForeignKey
ALTER TABLE "issue_messages" ADD CONSTRAINT "issue_messages_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "maintenance_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_messages" ADD CONSTRAINT "issue_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
