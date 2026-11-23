"use client";

import "../src/neander-design-pack/attio/2.0.0/attio-tokens.css";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { AttioCard, AttioSection, AttioStack } from "../src/neander-design-pack/attio/2.0.0/AttioLayouts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { auditActions, type AuditAction } from "../server/audit";

type AuditUser = { id: string; name: string; email: string; active: boolean };
type AuditEvent = {
  id: string;
  action: AuditAction;
  details: Record<string, unknown>;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
  actorLabel: string;
  recordLabel: string;
  recordHref: string | null;
};
type Filters = { action: string; userId: string; from: string; to: string };
type AuditResponse = { events: AuditEvent[]; users: AuditUser[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };

const actionLabels: Record<AuditAction, string> = {
  "staff.invited": "Staff invited",
  "staff.invitation_accepted": "Invitation accepted",
  "staff.role_changed": "Staff role changed",
  "staff.deactivated": "Staff deactivated",
  "staff.reactivated": "Staff reactivated",
  "staff.reset_link_created": "Password reset link created",
  "job.created": "Job created",
  "job.edited": "Job edited",
  "job.published": "Job published",
  "job.closed": "Job closed",
  "job.reopened": "Job reopened",
  "application.received": "Application received",
  "application.stage_changed": "Application stage changed",
  "application.note_added": "Application note added",
  "application.note_deleted": "Application note deleted",
};

function detailText(event: AuditEvent) {
  const details = event.details;
  if (event.action === "application.stage_changed" && typeof details.from === "string" && typeof details.to === "string") {
    return `${details.from} → ${details.to}`;
  }
  if (event.action === "staff.role_changed" && typeof details.previousRole === "string" && typeof details.role === "string") {
    return `${details.previousRole.replaceAll("_", " ")} → ${details.role.replaceAll("_", " ")}`;
  }
  if (event.action.startsWith("job.") && typeof details.from === "string" && typeof details.to === "string") {
    return `${details.from} → ${details.to}`;
  }
  if (typeof details.role === "string") return details.role.replaceAll("_", " ");
  return null;
}

export function AuditLog() {
  const [filters, setFilters] = useState<Filters>({ action: "all", userId: "all", from: "", to: "" });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [users, setUsers] = useState<AuditUser[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page) });
    if (appliedFilters.action !== "all") params.set("action", appliedFilters.action);
    if (appliedFilters.userId !== "all") params.set("userId", appliedFilters.userId);
    if (appliedFilters.from) params.set("from", appliedFilters.from);
    if (appliedFilters.to) params.set("to", appliedFilters.to);
    setLoading(true);
    setError("");
    void fetch(`/api/audit?${params.toString()}`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The audit trail could not be loaded.");
      setEvents(data.events);
      setUsers(data.users);
      setPage(data.pagination.page);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    }).catch((loadError) => {
      if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "The audit trail could not be loaded.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [appliedFilters, page]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedFilters({ ...filters });
  }

  function clearFilters() {
    const cleared = { action: "all", userId: "all", from: "", to: "" };
    setFilters(cleared);
    setAppliedFilters(cleared);
    setPage(1);
  }

  return <AttioStack gap={4}>
    <AttioSection title="Filter activity" description="Combine action, staff member, and date range filters.">
      <AttioCard>
        <form onSubmit={applyFilters} className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(8rem,1fr)_minmax(8rem,1fr)_auto] lg:items-end">
          <div className="grid min-w-0 gap-2"><Label htmlFor="audit-action">Action type</Label><Select value={filters.action} onValueChange={(action) => setFilters({ ...filters, action })}><SelectTrigger id="audit-action" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All actions</SelectItem>{auditActions.map((action) => <SelectItem key={action} value={action}>{actionLabels[action]}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid min-w-0 gap-2"><Label htmlFor="audit-user">User</Label><Select value={filters.userId} onValueChange={(userId) => setFilters({ ...filters, userId })}><SelectTrigger id="audit-user" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All users</SelectItem>{users.map((user) => <SelectItem key={user.id} value={user.id}>{user.name} · {user.email}{user.active ? "" : " · inactive"}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid min-w-0 gap-2"><Label htmlFor="audit-from">From</Label><Input id="audit-from" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></div>
          <div className="grid min-w-0 gap-2"><Label htmlFor="audit-to">To</Label><Input id="audit-to" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></div>
          <div className="flex flex-wrap gap-2"><Button type="submit">Apply</Button><Button type="button" variant="outline" onClick={clearFilters}>Clear</Button></div>
        </form>
      </AttioCard>
    </AttioSection>

    <AttioSection title="Activity" description={`${total.toLocaleString()} ${total === 1 ? "entry" : "entries"}`}>
      {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading audit activity…</p> : events.length === 0 ? <AttioCard><p className="py-7 text-center text-sm text-muted-foreground">No audit activity matches these filters.</p></AttioCard> : <div className="grid min-w-0 gap-2">
        {events.map((event) => <AttioCard key={event.id} padding={3}>
          <article className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <div className="grid min-w-0 gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2"><Badge variant="secondary">{actionLabels[event.action]}</Badge><span className="break-words text-sm text-muted-foreground">by <strong className="font-medium text-foreground">{event.actorLabel}</strong></span></div>
              <p className="min-w-0 break-words text-sm">Record: {event.recordHref ? <Link className="text-primary underline-offset-4 hover:underline" href={event.recordHref}>{event.recordLabel}</Link> : event.recordLabel}</p>
              {detailText(event) && <p className="break-words text-xs capitalize text-muted-foreground">{detailText(event)}</p>}
            </div>
            <time className="text-xs text-muted-foreground sm:text-right" dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
          </article>
        </AttioCard>)}
      </div>}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
        <div className="flex gap-2"><Button type="button" variant="outline" disabled={loading || page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button><Button type="button" variant="outline" disabled={loading || page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</Button></div>
      </div>
    </AttioSection>
  </AttioStack>;
}
