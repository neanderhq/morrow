import { and, asc, count, eq, ilike, inArray, max, or } from "drizzle-orm";
import { getMember } from "../../../server/access";
import { getDb } from "../../../server/db";
import { getAccessibleApplicationJobIds, parseCandidateSearch } from "../../../server/recruiting";
import { applications, candidates } from "../../../server/schema";
import { unauthorized } from "../../../server/http";

export async function GET(request: Request) {
  const member = await getMember(request.headers);
  if (!member) return unauthorized();
  const parsedSearch = parseCandidateSearch(new URL(request.url).searchParams.get("search"));
  if (!parsedSearch.ok) return Response.json({ error: "Search must be 120 characters or fewer." }, { status: 400 });

  const accessibleJobIds = await getAccessibleApplicationJobIds(member);
  if (accessibleJobIds !== null && !accessibleJobIds.length) return Response.json({ candidates: [] });

  const conditions = [eq(applications.workspaceId, member.workspaceId)];
  if (accessibleJobIds !== null) conditions.push(inArray(applications.jobId, accessibleJobIds));
  if (parsedSearch.search) {
    const pattern = `%${parsedSearch.search.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(or(
      ilike(candidates.name, pattern),
      ilike(candidates.email, pattern),
      ilike(applications.applicantName, pattern),
      ilike(applications.applicantEmail, pattern),
    )!);
  }

  const rows = await getDb().select({
    id: candidates.id,
    name: candidates.name,
    email: candidates.email,
    applicationCount: count(applications.id),
    latestApplicationAt: max(applications.createdAt),
  }).from(applications).innerJoin(candidates, and(
    eq(applications.candidateId, candidates.id), eq(applications.workspaceId, candidates.workspaceId),
  )).where(and(...conditions)).groupBy(candidates.id).orderBy(asc(candidates.name));

  return Response.json({ candidates: rows });
}
