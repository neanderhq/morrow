import { applicationWorkspace, type ApplicationParams } from "@/server/application-workspace";
import { changeScorecard, scorecardState } from "@/server/interview-scorecards";

export async function GET(request: Request, context: ApplicationParams) {
  const scope = await applicationWorkspace(request, context);
  return scope instanceof Response ? scope : Response.json(await scorecardState(scope));
}

export async function POST(request: Request, context: ApplicationParams) {
  const scope = await applicationWorkspace(request, context);
  if (scope instanceof Response) return scope;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  return changeScorecard(scope, body ?? {});
}
