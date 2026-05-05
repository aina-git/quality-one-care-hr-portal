-- CreateTable
CREATE TABLE "PersonalTodo" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalTodo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalTodo_userId_completed_idx" ON "PersonalTodo"("userId", "completed");

-- CreateIndex
CREATE INDEX "PersonalTodo_userId_sortOrder_idx" ON "PersonalTodo"("userId", "sortOrder");

-- AddForeignKey
ALTER TABLE "PersonalTodo" ADD CONSTRAINT "PersonalTodo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
