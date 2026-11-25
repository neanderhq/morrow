export const auditActions = [
  "staff.invited",
  "staff.invitation_accepted",
  "staff.role_changed",
  "staff.deactivated",
  "staff.reactivated",
  "staff.reset_link_created",
  "job.created",
  "job.edited",
  "job.published",
  "job.closed",
  "job.reopened",
  "application.received",
  "application.stage_changed",
  "application.note_added",
  "application.note_deleted",
  "interview.scheduled",
  "interview.rescheduled",
  "interview.cancelled",
  "application.rejection_email_prepared",
  "application.rejection_email_accepted",
  "application.rejection_email_failed",
  "application.rejection_email_unknown",
  "application.rejection_email_cancelled",
] as const;

export type AuditAction = (typeof auditActions)[number];

export const auditPageSize = 25;

export type AuditFilters = {
  action: AuditAction | null;
  userId: string | null;
  from: Date | null;
  to: Date | null;
  page: number;
};

type AuditFilterResult = { ok: true; filters: AuditFilters } | { ok: false; error: string };

function parseDate(value: string | null) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? undefined : date;
}

export function parseAuditFilters(params: URLSearchParams): AuditFilterResult {
  const actionValue = params.get("action");
  const action = actionValue && actionValue !== "all" ? auditActions.find((value) => value === actionValue) : null;
  if (actionValue && actionValue !== "all" && !action) return { ok: false, error: "Choose a valid audit action." };

  const userId = params.get("userId")?.trim() || null;
  if (userId && userId.length > 255) return { ok: false, error: "The user filter is invalid." };

  const from = parseDate(params.get("from"));
  const to = parseDate(params.get("to"));
  if (from === undefined || to === undefined) return { ok: false, error: "Enter valid dates for the audit range." };
  if (from && to && from > to) return { ok: false, error: "The start date must be on or before the end date." };
  if (to) to.setUTCDate(to.getUTCDate() + 1);

  const pageValue = params.get("page");
  const page = pageValue ? Number(pageValue) : 1;
  if (!Number.isInteger(page) || page < 1 || page > 100000) return { ok: false, error: "Choose a valid audit page." };

  return { ok: true, filters: { action: action ?? null, userId, from, to, page } };
}
