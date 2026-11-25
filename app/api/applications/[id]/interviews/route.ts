import { applicationWorkspace, type ApplicationParams } from "@/server/application-workspace";
import { changeInterview, interviewState } from "@/server/manual-interviews";

export async function GET(request: Request, context: ApplicationParams) {
  const scope = await applicationWorkspace(request, context);
  return scope instanceof Response ? scope : Response.json(await interviewState(scope));
}

export async function POST(request: Request, context: ApplicationParams) {
  const scope = await applicationWorkspace(request, context);
  if (scope instanceof Response) return scope;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  return changeInterview(scope, body ?? {});
}
