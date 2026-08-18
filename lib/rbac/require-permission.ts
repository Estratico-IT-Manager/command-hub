import { auth } from "@/lib/auth";
import { can } from "./index";
import { NextResponse } from "next/server";

export async function requirePermission(
  headersList: Headers,
  permission: string,
) {
  const session = await auth.api.getSession({ headers: headersList });
  if (!session?.user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const hasPermission = await can(session.user.id, permission);
  if (!hasPermission) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { user: session.user };
}