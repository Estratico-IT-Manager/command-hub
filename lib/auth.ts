import { betterAuth } from 'better-auth'
import { customSession } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from './prisma';
import { ALLOWED_DOMAIN, SUPER_ADMIN_EMAIL } from './constants';
import { env } from './env';
import { DEFAULT_ROLE_NAME, ROLES } from './rbac/permissions';
import { getPermissionSummary } from './rbac';


export const auth = betterAuth({
  database: prismaAdapter(prisma,{
    provider:"postgresql"
  }),

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          if (user.email === SUPER_ADMIN_EMAIL) {
            const role = await prisma.role.findUnique({
              where: { name: ROLES.SYSTEM_ADMIN }
            })
            if (role) {
              await prisma.roleAssignment.create({
                data: { userId: user.id, roleId: role.id }
              })
            }
          }
        }
      }
    }
  },
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
      bio:{
        type:"string",
      },
      whatsappNumber:{
        type:"string"
      }
    }
  },
  plugins: [
    customSession(async ({ user, session }) => {
      // Auto-assign default role on first session if user has no roles
      const existing = await prisma.roleAssignment.findFirst({
        where: { userId: user.id }
      })
      if (!existing) {
        const defaultRole = await prisma.role.findUnique({
          where: { name: DEFAULT_ROLE_NAME }
        })
        if (defaultRole) {
          await prisma.roleAssignment.create({
            data: { userId: user.id, roleId: defaultRole.id }
          })
        }
      }

      const summary = await getPermissionSummary(user.id)
      return {
        user: { ...user, permissions: summary.permissions },
        session,
      }
    }),
  ],
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