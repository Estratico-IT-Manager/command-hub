import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  DEFAULT_ROLE_NAME,
  PERMISSIONS,
  ROLES,
  ROLE_PERMISSIONS,
} from "../lib/rbac/permissions";
import { SUPER_ADMIN_EMAIL } from "../lib/constants";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
});

async function ensurePermissions(): Promise<Map<string, string>> {
  const permissionKeys = [
    ...new Set([
      ...Object.values(PERMISSIONS),
      ...Object.values(ROLE_PERMISSIONS).flat(),
    ]),
  ];

  const permissions = new Map<string, string>();
  for (const key of permissionKeys) {
    const permission = await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key },
    });
    permissions.set(key, permission.id);
  }

  await prisma.permission.deleteMany({
    where: { key: { notIn: permissionKeys } },
  });

  return permissions;
}

async function ensureRoles(permissions: Map<string, string>): Promise<void> {
  for (const [roleName, keys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });

    await prisma.rolePermission.deleteMany({
      where: {
        roleId: role.id,
        permissionId: { notIn: keys.map((key) => permissions.get(key)!) },
      },
    });

    for (const key of keys) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: permissions.get(key)! },
        },
        update: {},
        create: { roleId: role.id, permissionId: permissions.get(key)! },
      });
    }
  }
}

async function assignDefaultRoles(): Promise<number> {
  const [users, assignments] = await Promise.all([
    prisma.user.findMany({ select: { id: true } }),
    prisma.roleAssignment.findMany({ select: { userId: true } }),
  ]);

  const assignedUserIds = new Set(assignments.map((a) => a.userId));
  const unassigned = users.filter((u) => !assignedUserIds.has(u.id));

  if (unassigned.length === 0) return 0;

  const employeeRole = await prisma.role.findUnique({
    where: { name: DEFAULT_ROLE_NAME },
    select: { id: true },
  });
  if (!employeeRole) {
    throw new Error(`Default role "${DEFAULT_ROLE_NAME}" not found`);
  }

  const result = await prisma.roleAssignment.createMany({
    data: unassigned.map((u) => ({ userId: u.id, roleId: employeeRole.id })),
    skipDuplicates: true,
  });

  return result.count;
}

async function escalateSuperAdmin(): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email: SUPER_ADMIN_EMAIL },
    select: { id: true },
  });
  if (!user) return false;

  const role = await prisma.role.findUnique({
    where: { name: ROLES.SYSTEM_ADMIN },
    select: { id: true },
  });
  if (!role) {
    throw new Error(`Role "${ROLES.SYSTEM_ADMIN}" not found`);
  }

  const existing = await prisma.roleAssignment.findFirst({
    where: { userId: user.id, roleId: role.id },
    select: { id: true },
  });
  if (existing) return false;

  await prisma.roleAssignment.create({
    data: { userId: user.id, roleId: role.id },
  });
  return true;
}

async function main() {
  const permissions = await ensurePermissions();
  await ensureRoles(permissions);

  const assigned = await assignDefaultRoles();
  const escalated = await escalateSuperAdmin();

  const roleCount = await prisma.role.count();
  const permissionCount = await prisma.permission.count();
  const assignmentCount = await prisma.roleAssignment.count();

  console.log(`[backfill-rbac] roles: ${roleCount}, permissions: ${permissionCount}`);
  console.log(`[backfill-rbac] users assigned default role: ${assigned}`);
  console.log(`[backfill-rbac] super admin escalated: ${escalated}`);
  console.log(`[backfill-rbac] total role assignments: ${assignmentCount}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[backfill-rbac] FAILED:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });