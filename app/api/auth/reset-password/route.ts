import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "../../../../server/auth";
import { sameOrigin } from "../../../../server/http";
import { validPassword } from "../../../../server/security";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ message: "Request origin was not accepted." }, { status: 403 });
  const body = await request.clone().json().catch(() => null) as { newPassword?: string } | null;
  if (!validPassword(body?.newPassword ?? "")) {
    return Response.json({ message: "Password must be at least 12 characters." }, { status: 400 });
  }
  return toNextJsHandler(getAuth()).POST(request);
}
