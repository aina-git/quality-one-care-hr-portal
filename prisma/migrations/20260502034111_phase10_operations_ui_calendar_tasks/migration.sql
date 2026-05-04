-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('interview', 'onboarding', 'training', 'license_followup', 'document_followup', 'hr_task', 'meeting', 'reminder', 'other');

-- CreateEnum
CREATE TYPE "CalendarEventVisibility" AS ENUM ('internal', 'applicant_visible', 'executive_visible');

-- CreateEnum
CREATE TYPE "CalendarEventStatus" AS ENUM ('scheduled', 'completed', 'cancelled', 'missed', 'rescheduled');

-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM ('application_review', 'verification', 'onboarding', 'training', 'license_followup', 'document_request', 'interview', 'general');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('open', 'in_progress', 'completed', 'overdue', 'cancelled');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('task_due', 'interview', 'training', 'license_expiry', 'document_missing', 'follow_up', 'general');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('scheduled', 'triggered', 'dismissed', 'snoozed', 'cancelled');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('in_app', 'email', 'sms', 'whatsapp');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('queued', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('message', 'reminder', 'task', 'calendar', 'system_alert');

-- CreateTable
CREATE TABLE "CommunicationLog" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT,
    "senderId" TEXT,
    "recipientUserId" TEXT,
    "recipientEmail" TEXT,
    "channel" "MessageChannel" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'queued',
    "provider" TEXT,
    "providerResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsQueue" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT,
    "toPhone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "provider" TEXT,
    "providerMessageId" TEXT,
    "status" "EmailQueueStatus" NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppQueue" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT,
    "toPhone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "provider" TEXT,
    "providerMessageId" TEXT,
    "status" "EmailQueueStatus" NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventType" "CalendarEventType" NOT NULL DEFAULT 'other',
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "meetingLink" TEXT,
    "relatedApplicationId" TEXT,
    "relatedApplicantUserId" TEXT,
    "createdByUserId" TEXT,
    "assignedToUserId" TEXT,
    "visibility" "CalendarEventVisibility" NOT NULL DEFAULT 'internal',
    "status" "CalendarEventStatus" NOT NULL DEFAULT 'scheduled',
    "reminderMinutesBefore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "TaskCategory" NOT NULL DEFAULT 'general',
    "priority" "TaskPriority" NOT NULL DEFAULT 'normal',
    "status" "TaskStatus" NOT NULL DEFAULT 'open',
    "dueDate" TIMESTAMP(3),
    "assignedToUserId" TEXT,
    "createdByUserId" TEXT,
    "relatedApplicationId" TEXT,
    "relatedApplicantUserId" TEXT,
    "reminderDateTime" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "reminderType" "ReminderType" NOT NULL DEFAULT 'general',
    "triggerDateTime" TIMESTAMP(3) NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'scheduled',
    "priority" "TaskPriority" NOT NULL DEFAULT 'normal',
    "userId" TEXT NOT NULL,
    "relatedTaskId" TEXT,
    "relatedCalendarEventId" TEXT,
    "relatedApplicationId" TEXT,
    "deliveryChannels" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT,
    "notificationType" "NotificationType" NOT NULL,
    "priority" "TaskPriority" NOT NULL DEFAULT 'normal',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "route" TEXT,
    "readAt" TIMESTAMP(3),
    "relatedTaskId" TEXT,
    "relatedCalendarEventId" TEXT,
    "relatedReminderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunicationLog_applicationId_idx" ON "CommunicationLog"("applicationId");

-- CreateIndex
CREATE INDEX "CommunicationLog_recipientUserId_idx" ON "CommunicationLog"("recipientUserId");

-- CreateIndex
CREATE INDEX "CommunicationLog_channel_status_idx" ON "CommunicationLog"("channel", "status");

-- CreateIndex
CREATE INDEX "CommunicationLog_createdAt_idx" ON "CommunicationLog"("createdAt");

-- CreateIndex
CREATE INDEX "SmsQueue_applicationId_idx" ON "SmsQueue"("applicationId");

-- CreateIndex
CREATE INDEX "SmsQueue_status_idx" ON "SmsQueue"("status");

-- CreateIndex
CREATE INDEX "SmsQueue_queuedAt_idx" ON "SmsQueue"("queuedAt");

-- CreateIndex
CREATE INDEX "WhatsAppQueue_applicationId_idx" ON "WhatsAppQueue"("applicationId");

-- CreateIndex
CREATE INDEX "WhatsAppQueue_status_idx" ON "WhatsAppQueue"("status");

-- CreateIndex
CREATE INDEX "WhatsAppQueue_queuedAt_idx" ON "WhatsAppQueue"("queuedAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_startDateTime_idx" ON "CalendarEvent"("startDateTime");

-- CreateIndex
CREATE INDEX "CalendarEvent_eventType_idx" ON "CalendarEvent"("eventType");

-- CreateIndex
CREATE INDEX "CalendarEvent_status_idx" ON "CalendarEvent"("status");

-- CreateIndex
CREATE INDEX "CalendarEvent_visibility_idx" ON "CalendarEvent"("visibility");

-- CreateIndex
CREATE INDEX "CalendarEvent_relatedApplicationId_idx" ON "CalendarEvent"("relatedApplicationId");

-- CreateIndex
CREATE INDEX "CalendarEvent_relatedApplicantUserId_idx" ON "CalendarEvent"("relatedApplicantUserId");

-- CreateIndex
CREATE INDEX "CalendarEvent_assignedToUserId_idx" ON "CalendarEvent"("assignedToUserId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_priority_idx" ON "Task"("priority");

-- CreateIndex
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");

-- CreateIndex
CREATE INDEX "Task_assignedToUserId_idx" ON "Task"("assignedToUserId");

-- CreateIndex
CREATE INDEX "Task_relatedApplicationId_idx" ON "Task"("relatedApplicationId");

-- CreateIndex
CREATE INDEX "Task_relatedApplicantUserId_idx" ON "Task"("relatedApplicantUserId");

-- CreateIndex
CREATE INDEX "Reminder_userId_status_idx" ON "Reminder"("userId", "status");

-- CreateIndex
CREATE INDEX "Reminder_triggerDateTime_idx" ON "Reminder"("triggerDateTime");

-- CreateIndex
CREATE INDEX "Reminder_relatedTaskId_idx" ON "Reminder"("relatedTaskId");

-- CreateIndex
CREATE INDEX "Reminder_relatedCalendarEventId_idx" ON "Reminder"("relatedCalendarEventId");

-- CreateIndex
CREATE INDEX "Reminder_relatedApplicationId_idx" ON "Reminder"("relatedApplicationId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_notificationType_idx" ON "Notification"("notificationType");

-- CreateIndex
CREATE INDEX "Notification_priority_idx" ON "Notification"("priority");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_applicationId_idx" ON "Notification"("applicationId");

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_relatedApplicationId_fkey" FOREIGN KEY ("relatedApplicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_relatedApplicantUserId_fkey" FOREIGN KEY ("relatedApplicantUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_relatedApplicationId_fkey" FOREIGN KEY ("relatedApplicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_relatedApplicantUserId_fkey" FOREIGN KEY ("relatedApplicantUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_relatedTaskId_fkey" FOREIGN KEY ("relatedTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_relatedCalendarEventId_fkey" FOREIGN KEY ("relatedCalendarEventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_relatedApplicationId_fkey" FOREIGN KEY ("relatedApplicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_relatedTaskId_fkey" FOREIGN KEY ("relatedTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_relatedCalendarEventId_fkey" FOREIGN KEY ("relatedCalendarEventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_relatedReminderId_fkey" FOREIGN KEY ("relatedReminderId") REFERENCES "Reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
