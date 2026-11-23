import { sameOrigin } from "../../../server/http";
import {
  APPLICATION_CLIENT_ID_COOKIE,
  applicationClientIdentitySetCookie,
  issueApplicationClientIdentity,
  verifyApplicationClientIdentity,
} from "../../../server/application-rate-limit-policy";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request origin was not accepted." }, { status: 403 });

  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  if (!secret) return Response.json({ error: "Application form is temporarily unavailable. Please try again." }, { status: 503 });

  const cookiePrefix = `${APPLICATION_CLIENT_ID_COOKIE}=`;
  const existingCookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(cookiePrefix))?.slice(cookiePrefix.length) ?? null;
  const identity = existingCookie && verifyApplicationClientIdentity(existingCookie, secret) ? existingCookie : issueApplicationClientIdentity(secret);

  return Response.json({ ok: true }, {
    headers: {
      "Cache-Control": "no-store",
      "Set-Cookie": applicationClientIdentitySetCookie(identity, process.env.NODE_ENV === "production"),
    },
  });
}
