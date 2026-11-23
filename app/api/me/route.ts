import { getMember } from "../../../server/access";
import { unauthorized } from "../../../server/http";

export async function GET(request: Request) {
  const member = await getMember(request.headers);
  return member ? Response.json({ id: member.userId, name: member.name, email: member.email, role: member.role }) : unauthorized();
}
