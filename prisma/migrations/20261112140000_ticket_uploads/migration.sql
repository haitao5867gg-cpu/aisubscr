-- Pending ticket screenshots. The file is local; the row records who may attach it.
-- Existing TicketAttachment rows are unchanged.

CREATE TABLE "TicketUpload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TicketUpload_key_key" ON "TicketUpload"("key");

CREATE INDEX "TicketUpload_userId_createdAt_idx" ON "TicketUpload"("userId", "createdAt");
