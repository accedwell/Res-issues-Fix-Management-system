ALTER TABLE "maintenance_issues"
ADD COLUMN "system_report" JSONB,
ADD COLUMN "chatbot_submission_id" TEXT;

CREATE UNIQUE INDEX "maintenance_issues_chatbot_submission_id_key"
ON "maintenance_issues"("chatbot_submission_id");
