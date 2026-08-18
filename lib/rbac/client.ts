import { PERMISSIONS } from "./permissions";
import type { PermissionSummary } from "./types";

export function can(
  summary: PermissionSummary | null | undefined,
  permission: string,
): boolean {
  if (!summary) return false;
  if (summary.permissions.includes(PERMISSIONS.ALL)) return true;
  return summary.permissions.includes(permission);
}