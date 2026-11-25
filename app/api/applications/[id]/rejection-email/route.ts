import { applicationWorkspace, problem, type ApplicationParams } from "@/server/application-workspace";
import { canManageJobs } from "@/server/policy";
import { dispatchRejectionEmail, prepareRejectionEmail, rejectionState } from "@/server/rejection-emails";

async function scopedSender(request: Request, context: ApplicationParams) {
  const scope = await applicationWorkspace(request, context);
  if (scope instanceof Response) return scope;
  return canManageJobs(scope.member.role) ? scope : problem("Only Admins and Recruiters can access rejection email.", 403);
}

export async function GET(request: Request, context: ApplicationParams) {
  const scope = await scopedSender(request, context);
  return scope instanceof Response ? scope : Response.json(await rejectionState(scope));
}

export async function POST(request: Request, context: ApplicationParams) {
  const scope = await scopedSender(request, context);
  if (scope instanceof Response) return scope;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (body?.action === "prepare") return prepareRejectionEmail(scope, body);
  if (body?.action === "send" || body?.action === "retry") return dispatchRejectionEmail(scope, body.action, body.id);
  return problem("Choose a valid rejection email action.");
}
