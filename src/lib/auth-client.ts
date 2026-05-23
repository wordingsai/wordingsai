import "dotenv/config";
import {
  lastLoginMethodClient,
  organizationClient,
  multiSessionClient,
} from "better-auth/client/plugins";
import { stripeClient } from "@better-auth/stripe/client";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL:
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined"
      ? window.location.origin
      : process.env.BETTER_AUTH_URL),
  plugins: [
    organizationClient(),
    stripeClient({
      subscription: true,
    }),
    lastLoginMethodClient(),
    multiSessionClient(),
  ],
});
