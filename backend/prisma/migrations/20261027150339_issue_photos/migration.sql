-- CreateTable
CREATE TABLE "issue_photos" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "issue_photos_issue_id_key" ON "issue_photos"("issue_id");

-- AddForeignKey
ALTER TABLE "issue_photos" ADD CONSTRAINT "issue_photos_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "maintenance_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
