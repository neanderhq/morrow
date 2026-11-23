import { redirect } from "next/navigation";
import { AttioPage } from "../../../src/neander-design-pack/attio/2.0.0/AttioLayouts";
import { getMember } from "../../../server/access";
import { AuditLog } from "../../../components/audit-log";

export default async function AuditPage() {
  const member = await getMember();
  if (!member) redirect("/login");
  if (member.role !== "admin") redirect("/dashboard");

  return <div className="at-pack at-light">
    <AttioPage title="Audit" description="Workspace activity, with the actor, affected record, and time." width="wide">
      <AuditLog />
    </AttioPage>
  </div>;
}
