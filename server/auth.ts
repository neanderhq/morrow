import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { getDb } from "./db";
import { trustedOriginsForRequest } from "./http";
import { passwordResetSessionSettings } from "./auth-settings";
function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
function createAuth() {
  const baseURL = process.env.BETTER_AUTH_URL || (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : required("BETTER_AUTH_URL"));
  return betterAuth({
    baseURL, trustedOrigins: trustedOriginsForRequest, secret: required("BETTER_AUTH_SECRET"),
    database: drizzleAdapter(getDb(), { provider: "pg" }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      ...passwordResetSessionSettings,
      sendResetPassword: async ({ user, url }) => {
        const { savePasswordResetLink } = await import("./security");
        await savePasswordResetLink(user.id, url);
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  });
}
let auth: ReturnType<typeof createAuth> | undefined;
export function getAuth() { return auth ??= createAuth(); }
