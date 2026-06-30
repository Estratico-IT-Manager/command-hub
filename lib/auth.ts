import { betterAuth } from 'better-auth'
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from './prisma';
import { UserRole } from '@/app/generated/prisma/enums';
import { ALLOWED_DOMAIN } from './constants';
import { env } from './env';


export const auth = betterAuth({
  database: prismaAdapter(prisma,{
    provider:"postgresql"
  }),

  emailAndPassword: {
    enabled: true,
    async sendResetPassword({user,url}) {
      // In production, integrate with email service
      console.log(`Password reset for ${user.email}: ${url}`)
    }
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5 // 5 minutes
    }
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: UserRole.EMPLOYEE
      },
      bio:{
        type:"string",
      },
      whatsappNumber:{
        type:"string"
      }
    }
  },
  advanced: {
    cookiePrefix: 'estratico',
    useSecureCookies: env.NODE_ENV === 'production'
  },
  hooks: {
        before: async (ctx) => {
            const body = ctx.body as any;
            const baseUrl = env.BETTER_AUTH_URL;
        const url = new URL(ctx.request?.url ?? "", baseUrl);
            const path = url.pathname 


            // Check for both Email Sign-up and Social Sign-up/Sign-in
            const isSignUp =path.includes("/sign-up/email");
            const isSocial = path.includes("/callback/"); // Better Auth processes OAuth here

            if (isSignUp || isSocial) {
                const email = body?.email as string | undefined;

                if (email && !email.endsWith(`@${ALLOWED_DOMAIN}`)) {
                    throw new Error(`Access denied. Only @${ALLOWED_DOMAIN} addresses are permitted.`);
                }
            }

            return { context:ctx };
        },
    },
})

export type Auth = typeof auth
