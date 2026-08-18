import prisma from "@/lib/prisma";
import { PERMISSIONS } from "./permissions";
import type { PermissionSummary } from "./types";

export async function getPermissionSummary(
  userId: string,
): Promise<PermissionSummary> {
  const assignments = await prisma.roleAssignment.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  const permissions = [
    ...new Set(
      assignments.flatMap((a) =>
        a.role.permissions.map((rp) => rp.permission.key),
      ),
    ),
  ];
  const roleNames = assignments.map((a) => a.role.name);

  return { permissions, roleNames };
}

export async function can(
  userId: string,
  permission: string,
): Promise<boolean> {
  const { permissions } = await getPermissionSummary(userId);
  if (permissions.includes(PERMISSIONS.ALL)) return true;
  return permissions.includes(permission);
}