import { getMember } from "../../../../server/access";
import { getCandidateView } from "../../../../server/candidate-view";
import { isUuid } from "../../../../server/recruiting";
import { unauthorized } from "../../../../server/http";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const member = await getMember(request.headers);
  if (!member) return unauthorized();
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: "Candidate not found." }, { status: 404 });
  const view = await getCandidateView(member, id);
  if (!view) return Response.json({ error: "Candidate not found." }, { status: 404 });
  return Response.json(view);
}
