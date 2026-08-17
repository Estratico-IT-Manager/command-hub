import { EmailTemplate } from "@/components/email-template";
import { NextRequest } from "next/server";
import { resend } from "@/lib/resend";
import { requirePermission } from "@/lib/rbac/require-permission";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { headers } from "next/headers";

export async function POST(request: NextRequest) {
  const { error } = await requirePermission(
    await headers(),
    PERMISSIONS.EMAIL_SEND,
  );
  if (error) return error;

  const { type, ...rest } = await request.json();

  try {
    const { data, error } = await resend.emails.send({
      from: `Estratico <${rest.email}>`,
      to: [rest.to],
      subject: rest.subject,
      react: EmailTemplate({ type, data: rest }),
    });

    if (error) {
      console.error(error);
      return Response.json({ error }, { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    console.error(error);
    return Response.json({ error }, { status: 500 });
  }
}