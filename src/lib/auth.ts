import "dotenv/config";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { lastLoginMethod, organization } from "better-auth/plugins";
import { stripe as stripePlugin } from "@better-auth/stripe";
import { multiSession } from "better-auth/plugins/multi-session";
import type { Subscription } from "@better-auth/stripe";
import { Resend } from "resend";
import ForgotPasswordEmail from "@/components/emails/reset-password";
import VerifyEmail from "@/components/emails/verify-email";
import { db } from "@/db/drizzle";
import { schema } from "@/db/schema";
import { getActiveOrganization } from "@/server/organizations";
import { getActiveWorkspace } from "@/server/workspaces";
import { ac, psa, su, u } from "./auth/permissions";
import { stripe as stripeInstance } from "./stripe";
import { eq } from "drizzle-orm";

const resend = new Resend(process.env.RESEND_API_KEY as string);
const senderName = process.env.EMAIL_SENDER_NAME || "WordingsAI";
const senderAddress =
  process.env.EMAIL_SENDER_ADDRESS || "onboarding@resend.dev";

const getBaseURL = () => {
  if (process.env.BETTER_AUTH_URL) {
    return process.env.BETTER_AUTH_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
};

export const auth = betterAuth({
  baseURL: getBaseURL(),
  secret: process.env.BETTER_AUTH_SECRET,
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      try {
        const { error } = await resend.emails.send({
          from: `${senderName} <${senderAddress}>`,
          to: user.email,
          subject: "Verify your email",
          react: VerifyEmail({ username: user.name, verifyUrl: url }),
        });

        if (error) {
          console.error("Resend Error (Verification Email):", error);
        }
      } catch (err) {
        console.error("Failed to send verification email:", err);
      }
    },
    sendOnSignUp: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      try {
        const { error } = await resend.emails.send({
          from: `${senderName} <${senderAddress}>`,
          to: user.email,
          subject: "Reset your password",
          react: ForgotPasswordEmail({
            username: user.name,
            resetUrl: url,
            userEmail: user.email,
          }),
        });

        if (error) {
          console.error("Resend Error (Reset Password Email):", error);
        }
      } catch (err) {
        console.error("Failed to send reset password email:", err);
      }
    },
    requireEmailVerification: true,
  },
  session: {
    additionalFields: {
      activeWorkspaceId: {
        type: "string",
      },
      activeOrganizationId: {
        type: "string",
      },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const activeOrganization = await getActiveOrganization(
            session.userId,
          );
          let activeWorkspace = null;
          if (activeOrganization) {
            activeWorkspace = await getActiveWorkspace(
              session.userId,
              activeOrganization.id,
            );
          }
          return {
            data: {
              ...session,
              activeOrganizationId: activeOrganization?.id,
              activeOrganizationPlan: activeOrganization?.plan,
              activeWorkspaceId: activeWorkspace?.id,
            },
          };
        },
      },
      findMany: {
        after: async (sessions: any[]) => {
          // Refresh plan for each session to ensure it's up-to-date with database
          const updated = await Promise.all(
            sessions.map(async (session: any) => {
              const activeOrganization = await getActiveOrganization(
                session.userId,
                session.activeOrganizationId,
              );
              const activeWorkspace = activeOrganization
                ? await getActiveWorkspace(
                    session.userId,
                    activeOrganization.id,
                    session.activeWorkspaceId,
                  )
                : null;
              return {
                ...session,
                activeOrganizationId: activeOrganization?.id,
                activeOrganizationPlan: activeOrganization?.plan,
                activeWorkspaceId: activeWorkspace?.id,
              };
            }),
          );
          return updated;
        },
      },
    },
    subscription: {
      create: {
        after: async (subscription: any) => {
          if (subscription.organizationId) {
            const planStatus =
              subscription.status === "active" ||
              subscription.status === "trialing"
                ? subscription.plan === "plus"
                  ? "plus"
                  : "basic"
                : "fast";
            await db
              .update(schema.organization)
              .set({
                plan: planStatus as any,
                stripeCustomerId: subscription.stripeCustomerId,
                stripeSubscriptionId: subscription.stripeSubscriptionId,
                stripePriceId: subscription.stripePriceId,
                stripeCurrentPeriodEnd: subscription.expiresAt,
              })
              .where(eq(schema.organization.id, subscription.organizationId));
          }
        },
      },
      update: {
        after: async (subscription: any) => {
          if (subscription.organizationId) {
            const planStatus =
              subscription.status === "active" ||
              subscription.status === "trialing"
                ? subscription.plan === "plus"
                  ? "plus"
                  : "basic"
                : "fast";
            await db
              .update(schema.organization)
              .set({
                plan: planStatus as any,
                stripeCustomerId: subscription.stripeCustomerId,
                stripeSubscriptionId: subscription.stripeSubscriptionId,
                stripePriceId: subscription.stripePriceId,
                stripeCurrentPeriodEnd: subscription.expiresAt,
              })
              .where(eq(schema.organization.id, subscription.organizationId));
          }
        },
      },
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  plugins: [
    organization({
      ac: ac,
      creatorRole: "su",
      roles: {
        psa,
        su,
        u,
      },
      sendInvitationEmail: async (data) => {
        try {
          const { invitation, organization, inviter } = data;
          const { error } = await resend.emails.send({
            from: `${senderName} <${senderAddress}>`,
            to: invitation.email,
            subject: `You've been invited to join ${organization.name} on WordingsAI`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Welcome to WordingsAI!</h2>
                <p>${inviter.user.name} has invited you to join their organization: <strong>${organization.name}</strong>.</p>
                <p>Click the link below to accept the invitation:</p>
                <a href="${process.env.BETTER_AUTH_URL}/accept-invitation/${invitation.id}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">Accept Invitation</a>
                <p style="color: #666; margin-top: 20px;">This invitation expires in 7 days.</p>
              </div>
            `,
          });

          if (error) {
            console.error("Resend Error (Invitation Email):", error);
          }
        } catch (err) {
          console.error("Failed to send invitation email:", err);
        }
      },
    }),
    stripePlugin({
      stripeClient: stripeInstance!,
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      createCustomerOnSignUp: true,
      organization: {
        enabled: true,
      },
      subscription: {
        enabled: true,
        plans: [
          {
            name: "plus",
            priceId: process.env.STRIPE_PLUS_PRICE_ID!,
          },
          {
            name: "basic",
            priceId: process.env.STRIPE_BASIC_PRICE_ID || "free",
          },
        ],
      },
    }),
    lastLoginMethod(),
    multiSession(),
    // Must be last: forwards Set-Cookie to Next.js (see better-auth docs).
    nextCookies(),
  ],
});
