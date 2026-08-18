import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PERMISSIONS, ROLE_PERMISSIONS } from "../lib/rbac/permissions";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
});

async function main() {
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

  // Remove permission keys no longer in the catalog
  await prisma.permission.deleteMany({
    where: { key: { notIn: permissionKeys } },
  });

  for (const [roleName, keys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });

    // Remove links the role no longer has
    await prisma.rolePermission.deleteMany({
      where: {
        roleId: role.id,
        permissionId: { notIn: keys.map((key) => permissions.get(key)!) },
      },
    });

    const permissionIds = keys.map((key) => permissions.get(key)!);
    for (const permissionId of permissionIds) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId },
        },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }

    console.log(`Role "${roleName}" ready (${keys.length} permissions)`);
  }

  console.log("Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });