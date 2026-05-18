-- Convert all admin users to super_admin_hr (HR Coordinator)
UPDATE "User" SET "role" = 'super_admin_hr' WHERE "role" = 'admin';

-- Convert any leftover "hr" users to super_admin_hr as well
-- (the "hr" enum value stays for backward compat but new users use super_admin_hr)
UPDATE "User" SET "role" = 'super_admin_hr' WHERE "role" = 'hr';

-- Add super_admin_hr to MessageSenderRole enum
ALTER TYPE "MessageSenderRole" ADD VALUE IF NOT EXISTS 'super_admin_hr';

-- Convert existing admin sender roles in messages
UPDATE "Message" SET "senderRole" = 'super_admin_hr' WHERE "senderRole" = 'admin';
