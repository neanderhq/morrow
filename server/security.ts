import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
export { validEmail, validPassword, validRole } from "./policy.ts";

function encryptionKey() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is required");
  return createHash("sha256").update(secret).digest();
}

export function hashActionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createActionToken() {
  return randomBytes(32).toString("base64url");
}

export function encryptActionToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptActionToken(encryptedToken: string) {
  const [iv, tag, payload] = encryptedToken.split(".");
  if (!iv || !tag || !payload) throw new Error("Invalid encrypted action token");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(payload, "base64url")), decipher.final()]).toString("utf8");
}

export function invitationLinksForAdmin<T extends { encryptedToken: string | null }>(rows: T[], origin: string) {
  return rows.map(({ encryptedToken, ...invitation }) => ({
    ...invitation,
    inviteUrl: encryptedToken ? `${origin}/invite/${decryptActionToken(encryptedToken)}` : null,
  }));
}

export async function savePasswordResetLink(userId: string, url: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(url, "utf8"), cipher.final()]);
  const encryptedUrl = [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
  const [{ getDb }, { passwordResetLinks }] = await Promise.all([
    import("./db.ts"),
    import("./schema.ts"),
  ]);
  const db = getDb();
  await db.delete(passwordResetLinks).where(eq(passwordResetLinks.userId, userId));
  await db.insert(passwordResetLinks).values({
    userId,
    encryptedUrl,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
}

export function decryptPasswordResetLink(encryptedUrl: string) {
  const [iv, tag, payload] = encryptedUrl.split(".");
  if (!iv || !tag || !payload) throw new Error("Invalid reset link record");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(payload, "base64url")), decipher.final()]).toString("utf8");
}

export async function resetLinkForUser(userId: string) {
  const [{ getDb }, { passwordResetLinks }] = await Promise.all([
    import("./db.ts"),
    import("./schema.ts"),
  ]);
  const db = getDb();
  const [link] = await db.select().from(passwordResetLinks).where(and(
    eq(passwordResetLinks.userId, userId),
  )).orderBy(desc(passwordResetLinks.createdAt)).limit(1);
  return link;
}
