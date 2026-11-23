export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isStaffAccountId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 255;
}

export function normalizeApplicantEmail(value: string) {
  return value.trim().toLowerCase();
}

export function candidateProfileName(existingName: string | null, submittedName: string) {
  return existingName ?? submittedName;
}

export function parseCandidateSearch(value: string | null) {
  const search = value?.trim() ?? "";
  return search.length <= 120 ? { ok: true as const, search } : { ok: false as const };
}

export function validWebUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export type JobInput = {
  title: string;
  department: string | null;
  location: string;
  employmentType: "full_time" | "part_time" | "contract";
  remote: boolean;
  description: string;
  hiringManagerId: string;
  interviewerIds: string[];
};

export function parseJobInput(value: unknown): { ok: true; data: JobInput } | { ok: false; error: string } {
  if (!value || typeof value !== "object") return { ok: false, error: "Enter the job details." };
  const body = value as Record<string, unknown>;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const departmentValue = typeof body.department === "string" ? body.department.trim() : "";
  const location = typeof body.location === "string" ? body.location.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (title.length < 2 || title.length > 140) return { ok: false, error: "Job title must be between 2 and 140 characters." };
  if (departmentValue.length > 100) return { ok: false, error: "Department must be 100 characters or fewer." };
  if (!location || location.length > 140) return { ok: false, error: "Enter a location of 140 characters or fewer." };
  if (body.employmentType !== "full_time" && body.employmentType !== "part_time" && body.employmentType !== "contract") return { ok: false, error: "Choose a valid employment type." };
  if (typeof body.remote !== "boolean") return { ok: false, error: "Choose whether this job is remote." };
  if (description.length < 10 || description.length > 20000) return { ok: false, error: "Job description must be between 10 and 20,000 characters." };
  if (!isStaffAccountId(body.hiringManagerId)) return { ok: false, error: "Choose a hiring manager." };
  if (!Array.isArray(body.interviewerIds) || body.interviewerIds.length > 20 || !body.interviewerIds.every(isStaffAccountId)) return { ok: false, error: "Choose valid interviewers." };
  return {
    ok: true,
    data: {
      title,
      department: departmentValue || null,
      location,
      employmentType: body.employmentType,
      remote: body.remote,
      description,
      hiringManagerId: body.hiringManagerId,
      interviewerIds: [...new Set(body.interviewerIds)],
    },
  };
}
