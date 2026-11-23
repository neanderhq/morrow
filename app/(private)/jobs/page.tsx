import { getMember } from "../../../server/access";
import { JobManager } from "../../../components/job-manager";

export default async function JobsPage() {
  const member = await getMember();
  if (!member) return null;
  return <JobManager role={member.role} />;
}
