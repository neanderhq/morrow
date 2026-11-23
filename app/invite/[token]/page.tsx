import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { ArrowLeft, UserRoundPlus } from "lucide-react";
import { InviteAcceptForm } from "../../../components/auth-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "../../../server/db";
import { hashActionToken } from "../../../server/security";
import { invitations, workspaces } from "../../../server/schema";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invite] = await getDb().select({ email: invitations.email, role: invitations.role, expiresAt: invitations.expiresAt, workspaceName: workspaces.name })
    .from(invitations).innerJoin(workspaces, eq(invitations.workspaceId, workspaces.id)).where(and(
      eq(invitations.tokenHash, hashActionToken(token)), isNull(invitations.acceptedAt),
    )).limit(1);
  const valid = invite && invite.expiresAt.getTime() > Date.now();
  return <main className="mx-auto grid min-h-screen max-w-5xl items-center gap-8 px-4 py-10 md:grid-cols-[1fr_440px] md:px-8"><section><Link href="/login" className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4" />Back to sign in</Link><div className="mb-5 grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground"><UserRoundPlus /></div><p className="mb-2 text-sm font-medium text-primary">Join your team</p><h1 className="text-4xl font-semibold tracking-tight">You’re invited</h1><p className="mt-4 leading-7 text-muted-foreground">{valid ? `Create your account for ${invite.workspaceName}. Your role will be ${invite.role.replaceAll("_", " ")}.` : "This invitation has expired or has already been used. Ask an Admin for a new link."}</p></section><Card><CardHeader><CardTitle>{valid ? "Accept invitation" : "Invitation unavailable"}</CardTitle><CardDescription>{valid ? "Create a password to finish joining." : "Invitation links are single-use and expire after seven days."}</CardDescription></CardHeader><CardContent>{valid ? <InviteAcceptForm token={token} email={invite.email} /> : <Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" href="/login">Go to sign in</Link>}</CardContent></Card></main>;
}
