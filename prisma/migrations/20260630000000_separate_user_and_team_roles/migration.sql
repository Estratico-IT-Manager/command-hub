-- Create new enums
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE', 'INTERN');
CREATE TYPE "TeamRole" AS ENUM ('OWNER', 'MEMBER');

-- Add temporary columns with new types
ALTER TABLE "user" ADD COLUMN "userRoleTemp" "UserRole" NOT NULL DEFAULT 'EMPLOYEE';
ALTER TABLE "teamMember" ADD COLUMN "teamRoleTemp" "TeamRole" NOT NULL DEFAULT 'MEMBER';
ALTER TABLE "teamInvitation" ADD COLUMN "teamRoleTemp" "TeamRole" NOT NULL DEFAULT 'MEMBER';

-- Migrate data: map old Role values to new UserRole values
UPDATE "user" SET "userRoleTemp" = 'SUPER_ADMIN' WHERE "role" = 'SUPER_ADMIN';
UPDATE "user" SET "userRoleTemp" = 'ADMIN' WHERE "role" = 'ADMIN';
UPDATE "user" SET "userRoleTemp" = 'EMPLOYEE' WHERE "role" = 'MEMBER';
-- INTERN has no mapping from old roles, stays at default EMPLOYEE

-- Migrate data: map old Role values to new TeamRole values
UPDATE "teamMember" SET "teamRoleTemp" = 'OWNER' WHERE "role" = 'OWNER';
UPDATE "teamMember" SET "teamRoleTemp" = 'MEMBER' WHERE "role" IN ('ADMIN', 'MEMBER');

UPDATE "teamInvitation" SET "teamRoleTemp" = 'OWNER' WHERE "role" = 'OWNER';
UPDATE "teamInvitation" SET "teamRoleTemp" = 'MEMBER' WHERE "role" IN ('ADMIN', 'MEMBER');

-- Drop old columns
ALTER TABLE "user" DROP COLUMN "role";
ALTER TABLE "teamMember" DROP COLUMN "role";
ALTER TABLE "teamInvitation" DROP COLUMN "role";

-- Drop old enum
DROP TYPE "Role";

-- Rename temp columns
ALTER TABLE "user" RENAME COLUMN "userRoleTemp" TO "role";
ALTER TABLE "teamMember" RENAME COLUMN "teamRoleTemp" TO "role";
ALTER TABLE "teamInvitation" RENAME COLUMN "teamRoleTemp" TO "role";
