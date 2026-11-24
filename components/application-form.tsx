"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ApplicationForm({ jobId }: { jobId: string }) {
  const [values, setValues] = useState({ fullName: "", email: "", phone: "", portfolioUrl: "", coverNote: "" });
  const [error, setError] = useState("");
  const [resumeError, setResumeError] = useState("");
  const resumeInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (resumeError) resumeInput.current?.focus();
  }, [resumeError]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResumeError("");
    setPending(true);
    try {
      const formData = new FormData(event.currentTarget);
      const identityResponse = await fetch("/api/application-client", { method: "POST" });
      const identityData = await identityResponse.json();
      if (!identityResponse.ok) throw new Error(identityData.error || "Your application could not be sent. Please try again.");
      const response = await fetch(`/api/careers/${jobId}/applications`, { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) {
        if (data.field === "resume" && typeof data.error === "string") {
          setResumeError(data.error);
          return;
        }
        throw new Error(data.error || "Your application could not be sent. Please try again.");
      }
      window.location.assign("/careers/thanks");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Your application could not be sent. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={submit} className="grid gap-4">
    {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
    <div className="grid gap-2"><Label htmlFor="fullName">Full name</Label><Input id="fullName" name="fullName" required autoComplete="name" maxLength={200} value={values.fullName} onChange={(event) => setValues({ ...values, fullName: event.target.value })} /></div>
    <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="email">Email address</Label><Input id="email" name="email" required type="email" autoComplete="email" maxLength={320} value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} /></div><div className="grid gap-2"><Label htmlFor="phone">Phone <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={50} value={values.phone} onChange={(event) => setValues({ ...values, phone: event.target.value })} /></div></div>
    <div className="grid gap-2"><Label htmlFor="portfolioUrl">LinkedIn or portfolio link <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="portfolioUrl" name="portfolioUrl" type="url" placeholder="https://" maxLength={2048} value={values.portfolioUrl} onChange={(event) => setValues({ ...values, portfolioUrl: event.target.value })} /></div>
    <div className="grid min-w-0 gap-2">
      <Label htmlFor="resume">Resume</Label>
      <p id="resume-hint" className="text-sm text-muted-foreground">Required. PDF or DOCX, up to 5 MB.</p>
      <Input
        ref={resumeInput}
        id="resume"
        name="resume"
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        required
        aria-invalid={resumeError ? true : undefined}
        aria-describedby={resumeError ? "resume-hint resume-error" : "resume-hint"}
        onChange={() => setResumeError("")}
      />
      {resumeError && <p id="resume-error" role="alert" className="text-sm text-destructive">{resumeError}</p>}
    </div>
    <div className="grid gap-2"><Label htmlFor="coverNote">Short cover note <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea id="coverNote" name="coverNote" rows={4} maxLength={2000} value={values.coverNote} onChange={(event) => setValues({ ...values, coverNote: event.target.value })} /></div>
    <Button type="submit" disabled={pending}>{pending ? "Sending application…" : "Submit application"}</Button>
  </form>;
}
