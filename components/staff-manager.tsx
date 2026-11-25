"use client";

import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, LoaderCircle, UserPlus, UserRoundCheck, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkResult } from "@/components/auth-forms";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import { staffRoleChangeConfirmation } from "../server/confirmations";

type Role = "admin" | "recruiter" | "hiring_manager" | "interviewer";
type Staff = { id: string; name: string; email: string; role: Role; active: boolean };
type Invite = { id: string; email: string; role: Role; expiresAt: string; inviteUrl: string | null };
const roleNames: Record<Role, string> = { admin: "Admin", recruiter: "Recruiter", hiring_manager: "Hiring Manager", interviewer: "Interviewer" };

export function StaffManager() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [link, setLink] = useState<{ title: string; url: string; note: string } | null>(null);
  const [inviteCopyFeedback, setInviteCopyFeedback] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [staffResponse, inviteResponse] = await Promise.all([fetch("/api/staff"), fetch("/api/invitations")]);
    if (!staffResponse.ok) return setError("Staff list could not be loaded.");
    if (!inviteResponse.ok) return setError("Pending invitations could not be loaded.");
    const staffData = await staffResponse.json();
    const inviteData = await inviteResponse.json();
    setStaff(staffData.staff);
    setInvites(inviteData.invitations ?? []);
  }

  useEffect(() => { void load(); }, []);

  async function api(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(result.error ?? "The change could not be saved."); return null; }
    await load();
    return result;
  }

  async function invite(formData: FormData) {
    await api("/api/invitations", "POST", { email: formData.get("email"), role: formData.get("role") });
  }

  async function copyInvite(invitation: Invite) {
    if (!invitation.inviteUrl) return;
    const copied = await copyTextToClipboard(invitation.inviteUrl);
    setInviteCopyFeedback((current) => ({ ...current, [invitation.id]: copied }));
  }

  async function changeRole(person: Staff, role: Role) {
    if (person.role === role) return;
    const confirmation = staffRoleChangeConfirmation(person.name, person.role, role);
    if (confirmation && !window.confirm(confirmation)) return;
    await api(`/api/staff/${person.id}/role`, "PATCH", { role });
  }
  async function deactivate(person: Staff) {
    if (!window.confirm(`Deactivate ${person.name}? They will be signed out and cannot sign in again.`)) return;
    await api(`/api/staff/${person.id}/deactivate`, "POST");
  }
  async function reactivate(person: Staff) {
    await api(`/api/staff/${person.id}/reactivate`, "POST");
  }
  async function reset(person: Staff) {
    const result = await api(`/api/staff/${person.id}/reset-link`, "POST");
    if (result?.resetUrl) setLink({ title: `Password reset for ${person.name}`, url: result.resetUrl, note: "Share directly with this person using a trusted channel. It expires in one hour. No email was sent." });
  }

  return <div className="grid min-w-0 grid-cols-1 gap-6">
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="size-5" />Invite a teammate</CardTitle><CardDescription>Choose their workspace access. A secure link appears here for you to copy; the app does not send email.</CardDescription></CardHeader><CardContent><form action={invite} className="grid gap-4 md:grid-cols-[1fr_220px_auto] md:items-end"><div className="grid gap-2"><Label htmlFor="invite-email">Work email</Label><Input id="invite-email" name="email" type="email" placeholder="name@company.com" required /></div><div className="grid gap-2"><Label htmlFor="invite-role">Role</Label><select id="invite-role" name="role" defaultValue="recruiter" className="h-9 rounded-md border border-input bg-background px-3 text-sm"><option value="admin">Admin</option><option value="recruiter">Recruiter</option><option value="hiring_manager">Hiring Manager</option><option value="interviewer">Interviewer</option></select></div><Button type="submit" disabled={busy}>{busy ? <LoaderCircle className="animate-spin" /> : <UserPlus />}Create invite link</Button></form></CardContent></Card>
    {link && <LinkResult {...link} />}
    {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    <Card><CardHeader><CardTitle>Workspace staff <Badge variant="secondary" className="ml-2">{staff.length}</Badge></CardTitle><CardDescription>Changes take effect on the server. Deactivated staff lose existing sessions.</CardDescription></CardHeader><CardContent className="grid min-w-0 grid-cols-1 gap-3">{staff.map((person) => <div id={`staff-${person.id}`} key={person.id} className="grid min-w-0 grid-cols-1 gap-3 rounded-lg border p-4 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-center"><div className="min-w-0"><p className="flex min-w-0 flex-wrap items-center gap-2 font-medium"><span className="min-w-0 wrap-anywhere">{person.name}</span>{person.active ? null : <Badge variant="outline">Inactive</Badge>}</p><p className="wrap-anywhere text-sm text-muted-foreground">{person.email}</p></div><select aria-label={`Role for ${person.name}`} value={person.role} disabled={busy || !person.active} onChange={(event) => void changeRole(person, event.target.value as Role)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm md:w-auto"><option value="admin">Admin</option><option value="recruiter">Recruiter</option><option value="hiring_manager">Hiring Manager</option><option value="interviewer">Interviewer</option></select><div className="flex flex-wrap gap-2">{person.active ? <><Button size="sm" variant="outline" disabled={busy} onClick={() => void reset(person)}><KeyRound />Reset password</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void deactivate(person)}><UserX />Deactivate</Button></> : <Button size="sm" variant="outline" disabled={busy} onClick={() => void reactivate(person)}><UserRoundCheck />Reactivate</Button>}</div></div>)}</CardContent></Card>
    <Card><CardHeader><CardTitle>Pending invitations</CardTitle><CardDescription>Active links expire after seven days and can only be used once.</CardDescription></CardHeader><CardContent className="grid gap-3">{invites.length ? invites.map((invite) => <div id={`invite-${invite.id}`} key={invite.id} className="grid min-w-0 gap-2 rounded-md border p-3"><div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-sm"><span className="min-w-0 wrap-anywhere">{invite.email}</span><Badge variant="secondary">{roleNames[invite.role]}</Badge></div>{invite.inviteUrl ? <><div className="flex min-w-0 flex-col gap-2 sm:flex-row"><Input value={invite.inviteUrl} readOnly aria-label={`Invitation link for ${invite.email}`} onFocus={(event) => event.currentTarget.select()} /><Button type="button" variant="outline" onClick={() => void copyInvite(invite)}>{inviteCopyFeedback[invite.id] ? <Check /> : <Copy />}{inviteCopyFeedback[invite.id] ? "Copied" : "Copy link"}</Button></div>{inviteCopyFeedback[invite.id] !== undefined && <p role={inviteCopyFeedback[invite.id] ? "status" : "alert"} className={`text-sm ${inviteCopyFeedback[invite.id] ? "text-success" : "text-destructive"}`}>{inviteCopyFeedback[invite.id] ? "Invitation link copied." : "Copy was blocked. Select the link above and copy it."}</p>}</> : <p className="text-sm text-muted-foreground">A link isn’t available for this invitation. Create a replacement invite to generate a new link.</p>}</div>) : <p className="text-sm text-muted-foreground">No pending invitations.</p>}</CardContent></Card>
  </div>;
}
