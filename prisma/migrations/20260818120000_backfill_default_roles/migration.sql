-- Backfill role assignments for existing users after RBAC rollout.
-- Idempotent: every statement is guarded by NOT EXISTS.

-- Escalate the super admin account to System Admin if it lacks the role
INSERT INTO "roleAssignment" ("id", "userId", "roleId")
SELECT gen_random_uuid(), u."id", r."id"
FROM "user" u
CROSS JOIN "role" r
WHERE u."email" = 'itmanagement@estratico.org.zw'
  AND r."name" = 'System Admin'
  AND NOT EXISTS (
    SELECT 1 FROM "roleAssignment" ra
    WHERE ra."userId" = u."id" AND ra."roleId" = r."id"
  );

-- Give every user without any role assignment the default Employee role
INSERT INTO "roleAssignment" ("id", "userId", "roleId")
SELECT gen_random_uuid(), u."id", r."id"
FROM "user" u
CROSS JOIN "role" r
WHERE r."name" = 'Employee'
  AND NOT EXISTS (
    SELECT 1 FROM "roleAssignment" ra
    WHERE ra."userId" = u."id"
  );