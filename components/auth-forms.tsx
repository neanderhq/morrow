"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Copy, LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetCompletionFeedback } from "../server/reset-feedback";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";

type MessageState = { type: "error" | "success"; text: string } | null;

function Message({ value }: { value: MessageState }) {
  if (!value) return null;
  const Icon = value.type === "error" ? AlertCircle : CheckCircle2;
  return <p role="status" className={`flex items-start gap-2 rounded-md border p-3 text-sm ${value.type === "error" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-success/30 bg-success/5 text-success"}`}><Icon className="mt-0.5 size-4 shrink-0" />{value.text}</p>;
}

function Field({ id, label, type = "text", autoComplete, required = true }: { id: string; label: string; type?: string; autoComplete?: string; required?: boolean }) {
  return <div className="grid gap-2"><Label htmlFor={id}>{label}</Label><Input id={id} name={id} type={type} autoComplete={autoComplete} required={required} /></div>;
}

export function SetupForm() {
  const router = useRouter();
  const [message, setMessage] = useState<MessageState>(null);
  const [busy, setBusy] = useState(false);

  async function submit(formData: FormData) {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/setup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(formData)) });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage({ type: "error", text: result.error ?? "Setup could not be completed." });
    setMessage({ type: "success", text: "Workspace ready. Sign in with your Admin account." });
    setTimeout(() => router.push("/login"), 900);
  }

  return <form action={submit} className="grid gap-5">
    <Field id="workspaceName" label="Company or workspace name" autoComplete="organization" />
    <div className="grid gap-4 sm:grid-cols-2"><Field id="name" label="Your name" autoComplete="name" /><Field id="email" label="Work email" type="email" autoComplete="email" /></div>
    <div className="grid gap-2"><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /><p className="text-xs text-muted-foreground">Use at least 12 characters. Your account becomes the workspace Admin.</p></div>
    <Message value={message} />
    <Button type="submit" disabled={busy}>{busy && <LoaderCircle className="animate-spin" />}Create workspace</Button>
  </form>;
}

export function LoginForm() {
  const router = useRouter();
  const [message, setMessage] = useState<MessageState>(null);
  const [busy, setBusy] = useState(false);

  async function submit(formData: FormData) {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/auth/sign-in/email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(formData)) });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setMessage({ type: "error", text: result.message ?? "Incorrect email or password." });
    router.push("/dashboard");
    router.refresh();
  }

  return <form action={submit} className="grid gap-5">
    <Field id="email" label="Email address" type="email" autoComplete="email" />
    <Field id="password" label="Password" type="password" autoComplete="current-password" />
    <Message value={message} />
    <Button type="submit" disabled={busy}>{busy && <LoaderCircle className="animate-spin" />}Sign in</Button>
    <p className="text-sm leading-6 text-muted-foreground">Forgot your password? Ask your workspace Admin to create a secure reset link. This app does not send email.</p>
  </form>;
}

export function InviteAcceptForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<MessageState>(null);
  const [busy, setBusy] = useState(false);

  async function submit(formData: FormData) {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/invitations/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, name: formData.get("name"), password: formData.get("password") }) });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage({ type: "error", text: result.error ?? "This invitation could not be accepted." });
    setMessage({ type: "success", text: result.message });
    setTimeout(() => router.push("/login"), 900);
  }

  return <form action={submit} className="grid gap-5"><div className="grid gap-2"><Label>Email address</Label><Input value={email} readOnly /></div><Field id="name" label="Your name" autoComplete="name" /><div className="grid gap-2"><Label htmlFor="password">Create password</Label><Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /><p className="text-xs text-muted-foreground">At least 12 characters.</p></div><Message value={message} /><Button type="submit" disabled={busy}>{busy && <LoaderCircle className="animate-spin" />}Accept invitation</Button></form>;
}

export function ResetPasswordForm({ token }: { token?: string }) {
  const [message, setMessage] = useState<MessageState>(null);
  const [confirmation, setConfirmation] = useState("");
  const [logoutWarning, setLogoutWarning] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(formData: FormData) {
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");
    if (!token) return setMessage({ type: "error", text: "This reset link is missing its token. Ask your Admin for a new link." });
    if (password !== confirm) return setMessage({ type: "error", text: "The passwords do not match." });
    setBusy(true);
    setMessage(null);
    setConfirmation("");
    setLogoutWarning("");
    try {
      const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, newPassword: password }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ type: "error", text: result.message ?? "Reset link is invalid or expired. Ask your Admin for a new one." });
        setBusy(false);
        return;
      }
    } catch {
      setMessage({ type: "error", text: "The password could not be reset. Check your connection and try again." });
      setBusy(false);
      return;
    }
    let loggedOut = false;
    try {
      const response = await fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ disableRedirect: true }) });
      loggedOut = response.ok;
    } catch {
      loggedOut = false;
    }
    const feedback = resetCompletionFeedback(loggedOut);
    setConfirmation(feedback.confirmation);
    setLogoutWarning(feedback.logoutWarning ?? "");
    setBusy(false);
  }

  return <form action={submit} className="grid gap-5"><div className="grid gap-2"><Label htmlFor="password">New password</Label><Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></div><div className="grid gap-2"><Label htmlFor="confirm">Confirm new password</Label><Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></div><p className="text-xs text-muted-foreground">Use at least 12 characters.</p><Message value={message} />{confirmation && <div role="status" className="grid gap-2 rounded-md border border-success/30 bg-success/5 p-3 text-sm text-success"><p>{confirmation}</p><Link href="/login" className="font-medium underline underline-offset-4">Continue to sign in</Link></div>}{logoutWarning && <p role="alert" className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-warning">{logoutWarning}</p>}<Button type="submit" disabled={busy}>{busy && <LoaderCircle className="animate-spin" />}Update password</Button></form>;
}

export function ProfileEditor({ initialName, email, role }: { initialName: string; email: string; role: string }) {
  const [name, setName] = useState(initialName);
  const [message, setMessage] = useState<MessageState>(null);
  const [busy, setBusy] = useState(false);
  async function submit(formData: FormData) {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: formData.get("name") }) });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage({ type: "error", text: result.error ?? "Profile could not be saved." });
    setName(result.name);
    setMessage({ type: "success", text: "Profile saved." });
  }
  return <form action={submit} className="grid gap-5"><div className="grid gap-2"><Label htmlFor="email">Email</Label><Input id="email" value={email} readOnly /></div><div className="grid gap-2"><Label htmlFor="role">Workspace role</Label><Input id="role" value={role.replaceAll("_", " ")} readOnly className="capitalize" /></div><div className="grid gap-2"><Label htmlFor="name">Your name</Label><Input id="name" name="name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} required /></div><Message value={message} /><Button type="submit" disabled={busy}>{busy && <LoaderCircle className="animate-spin" />}Save profile</Button></form>;
}

export function LinkResult({ url, title, note }: { url: string; title: string; note: string }) {
  const [copyFeedback, setCopyFeedback] = useState<boolean | null>(null);
  async function copyLink() {
    setCopyFeedback(await copyTextToClipboard(url));
  }
  return <Card className="border-primary/30 bg-primary/5"><CardHeader className="pb-3"><div className="flex items-center justify-between gap-2"><CardTitle className="text-base">{title}</CardTitle><Badge variant="secondary">One-time link</Badge></div><CardDescription>{note}</CardDescription></CardHeader><CardContent className="grid gap-3"><Input value={url} readOnly aria-label={title} onFocus={(event) => event.currentTarget.select()} /><Button type="button" variant="outline" onClick={() => void copyLink()}><Copy />{copyFeedback ? "Copied" : "Copy link"}</Button>{copyFeedback !== null && <p role={copyFeedback ? "status" : "alert"} className={`text-sm ${copyFeedback ? "text-success" : "text-destructive"}`}>{copyFeedback ? "Link copied." : "Copy was blocked. Select the link above and copy it."}</p>}</CardContent></Card>;
}
