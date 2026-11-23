import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileEditor } from "../../../components/auth-forms";
import { getMember } from "../../../server/access";

export default async function ProfilePage() {
  const member = await getMember();
  if (!member) return null;
  return <div className="grid gap-6"><header><Badge variant="secondary" className="mb-3">Your account</Badge><h1>Profile</h1><p className="mt-2 text-muted-foreground">Only you can view and update this profile.</p></header><Card className="max-w-2xl"><CardHeader><CardTitle>Personal details</CardTitle><CardDescription>Your role is managed by a workspace Admin.</CardDescription></CardHeader><CardContent><ProfileEditor initialName={member.name} email={member.email} role={member.role} /></CardContent></Card></div>;
}
