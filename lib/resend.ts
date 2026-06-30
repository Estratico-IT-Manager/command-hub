import { Resend } from "resend";
import { env } from "./env";

declare global {
  var resend: Resend | undefined;
}

const resendClient = globalThis.resend || new Resend(env.RESEND_API_KEY);

if (env.NODE_ENV !== "production") {
  globalThis.resend = resendClient;
}
export const resend = resendClient;