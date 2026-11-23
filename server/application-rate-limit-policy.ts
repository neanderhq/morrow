import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const APPLICATION_SUBMISSION_LIMIT = 5;
export const APPLICATION_SUBMISSION_WINDOW_MS = 60_000;
export const APPLICATION_CLIENT_ID_COOKIE = "application_client_identity";
const APPLICATION_CLIENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function signature(identity: string, secret: string) {
  return createHmac("sha256", secret).update(`application-client:v1:${identity}`).digest("hex");
}

export function issueApplicationClientIdentity(secret: string) {
  if (!secret) throw new Error("A signing secret is required to issue an application identity.");
  const identity = randomUUID();
  return `${identity}.${signature(identity, secret)}`;
}

export function verifyApplicationClientIdentity(value: string | null, secret: string) {
  if (!value || !secret) return null;
  const [identity, providedSignature, ...extra] = value.split(".");
  if (extra.length || !APPLICATION_CLIENT_ID_PATTERN.test(identity ?? "") || !/^[0-9a-f]{64}$/i.test(providedSignature ?? "")) return null;
  const expectedSignature = Buffer.from(signature(identity, secret), "hex");
  const actualSignature = Buffer.from(providedSignature, "hex");
  if (!timingSafeEqual(expectedSignature, actualSignature)) return null;
  return identity;
}

function applicationClientCookie(headers: Headers) {
  const prefix = `${APPLICATION_CLIENT_ID_COOKIE}=`;
  const cookie = headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return cookie?.slice(prefix.length) ?? null;
}

export function applicationSubmissionClientKey(headers: Headers, secret: string) {
  const identity = verifyApplicationClientIdentity(applicationClientCookie(headers), secret);
  return identity ? createHmac("sha256", secret).update(`application-rate-limit:v1:${identity}`).digest("hex") : null;
}

export function applicationClientIdentitySetCookie(value: string, secure: boolean) {
  return `${APPLICATION_CLIENT_ID_COOKIE}=${value}; Path=/api; Max-Age=31536000; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function shouldAcceptApplicationSubmission(requestCount: number) {
  return requestCount <= APPLICATION_SUBMISSION_LIMIT;
}
