-- Create RBAC tables
CREATE TABLE "role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    CONSTRAINT "permission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    CONSTRAINT "rolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

CREATE TABLE "roleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    CONSTRAINT "roleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "role_name_key" ON "role"("name");
CREATE UNIQUE INDEX "permission_key_key" ON "permission"("key");
CREATE INDEX "rolePermission_permissionId_idx" ON "rolePermission"("permissionId");
CREATE INDEX "roleAssignment_userId_idx" ON "roleAssignment"("userId");
CREATE INDEX "roleAssignment_roleId_idx" ON "roleAssignment"("roleId");

ALTER TABLE "rolePermission" ADD CONSTRAINT "rolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rolePermission" ADD CONSTRAINT "rolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "roleAssignment" ADD CONSTRAINT "roleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "roleAssignment" ADD CONSTRAINT "roleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed permissions
INSERT INTO "permission" ("id", "key") VALUES
    (gen_random_uuid(), 'all'),
    (gen_random_uuid(), 'user.manage_roles'),
    (gen_random_uuid(), 'admin.dashboard.access'),
    (gen_random_uuid(), 'email.send'),
    (gen_random_uuid(), 'sync.run'),
    (gen_random_uuid(), 'audit.view'),
    (gen_random_uuid(), 'subscription.view_all'),
    (gen_random_uuid(), 'subscription.manage_all'),
    (gen_random_uuid(), 'project.manage_all'),
    (gen_random_uuid(), 'task.manage_all'),
    (gen_random_uuid(), 'team.manage_all')
ON CONFLICT ("key") DO NOTHING;

-- Seed roles
INSERT INTO "role" ("id", "name") VALUES
    (gen_random_uuid(), 'System Admin'),
    (gen_random_uuid(), 'Admin'),
    (gen_random_uuid(), 'Employee'),
    (gen_random_uuid(), 'Intern')
ON CONFLICT ("name") DO NOTHING;

-- Link role bundles
INSERT INTO "rolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "role" r
JOIN "permission" p ON (
    (r."name" = 'System Admin' AND p."key" = 'all')
    OR (r."name" = 'Admin' AND p."key" IN (
        'user.manage_roles', 'admin.dashboard.access', 'email.send', 'sync.run',
        'audit.view', 'subscription.view_all', 'subscription.manage_all',
        'project.manage_all', 'task.manage_all', 'team.manage_all'
    ))
    OR (r."name" = 'Employee' AND p."key" = 'sync.run')
)
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Migrate existing users to role assignments
INSERT INTO "roleAssignment" ("id", "userId", "roleId")
SELECT gen_random_uuid(), u."id", r."id"
FROM "user" u
JOIN "role" r ON r."name" = CASE COALESCE(u."role", 'EMPLOYEE')
    WHEN 'SUPER_ADMIN' THEN 'System Admin'
    WHEN 'ADMIN' THEN 'Admin'
    WHEN 'INTERN' THEN 'Intern'
    ELSE 'Employee'
END;

-- Drop legacy role column and enum
ALTER TABLE "user" DROP COLUMN "role";
DROP TYPE "UserRole";