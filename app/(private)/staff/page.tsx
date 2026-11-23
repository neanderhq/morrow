import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getMember } from "../../../server/access";
import { StaffManager } from "../../../components/staff-manager";

export default async function StaffPage() {
  const member = await getMember();
  if (!member) redirect("/login");
  if (member.role !== "admin") redirect("/dashboard");
  return <div className="grid gap-6"><header><Badge variant="secondary" className="mb-3">Admin only</Badge><h1>Staff</h1><p className="mt-2 text-muted-foreground">Invite people, update their access, and keep your workspace secure.</p></header><StaffManager /></div>;
}
