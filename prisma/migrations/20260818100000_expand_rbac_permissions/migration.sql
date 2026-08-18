-- Expand permission catalog to full CRUD per entity

-- Insert new permission keys
INSERT INTO "permission" ("id", "key") VALUES
    (gen_random_uuid(), 'user.view'),
    (gen_random_uuid(), 'user.edit'),
    (gen_random_uuid(), 'user.delete'),
    (gen_random_uuid(), 'role.view'),
    (gen_random_uuid(), 'role.create'),
    (gen_random_uuid(), 'role.edit'),
    (gen_random_uuid(), 'role.delete'),
    (gen_random_uuid(), 'role.assign'),
    (gen_random_uuid(), 'audit_log.view'),
    (gen_random_uuid(), 'sync.view'),
    (gen_random_uuid(), 'team.create'),
    (gen_random_uuid(), 'team.view'),
    (gen_random_uuid(), 'team.edit'),
    (gen_random_uuid(), 'team.delete'),
    (gen_random_uuid(), 'team.invite'),
    (gen_random_uuid(), 'team.member.edit'),
    (gen_random_uuid(), 'team.member.remove'),
    (gen_random_uuid(), 'project.create'),
    (gen_random_uuid(), 'project.view'),
    (gen_random_uuid(), 'project.edit'),
    (gen_random_uuid(), 'project.delete'),
    (gen_random_uuid(), 'task.create'),
    (gen_random_uuid(), 'task.view'),
    (gen_random_uuid(), 'task.edit'),
    (gen_random_uuid(), 'task.delete'),
    (gen_random_uuid(), 'subscription.create'),
    (gen_random_uuid(), 'subscription.view'),
    (gen_random_uuid(), 'subscription.edit'),
    (gen_random_uuid(), 'subscription.delete'),
    (gen_random_uuid(), 'subscription_history.create'),
    (gen_random_uuid(), 'subscription_history.view'),
    (gen_random_uuid(), 'subscription_history.edit'),
    (gen_random_uuid(), 'subscription_history.delete')
ON CONFLICT ("key") DO NOTHING;

-- Remove obsolete permission keys (cascades to role links)
DELETE FROM "permission" WHERE "key" IN (
    'user.manage_roles',
    'audit.view',
    'subscription.view_all',
    'subscription.manage_all',
    'project.manage_all',
    'task.manage_all',
    'team.manage_all'
);

-- Rebuild Admin role bundle with the full CRUD catalog
DELETE FROM "rolePermission" WHERE "roleId" = (SELECT "id" FROM "role" WHERE "name" = 'Admin');

INSERT INTO "rolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "role" r
CROSS JOIN "permission" p
WHERE r."name" = 'Admin'
  AND p."key" IN (
    'all', 'user.view', 'user.edit', 'user.delete',
    'role.view', 'role.create', 'role.edit', 'role.delete', 'role.assign',
    'audit_log.view', 'sync.run', 'sync.view', 'email.send', 'admin.dashboard.access',
    'team.create', 'team.view', 'team.edit', 'team.delete', 'team.invite',
    'team.member.edit', 'team.member.remove',
    'project.create', 'project.view', 'project.edit', 'project.delete',
    'task.create', 'task.view', 'task.edit', 'task.delete',
    'subscription.create', 'subscription.view', 'subscription.edit', 'subscription.delete',
    'subscription_history.create', 'subscription_history.view',
    'subscription_history.edit', 'subscription_history.delete'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;