export type JobState = "draft" | "published" | "closed";
export type JobStatusAction = "publish" | "close" | "reopen";

export function nextJobState(state: JobState, action: JobStatusAction, reopenState: JobState | null) {
  if (action === "publish") return state === "draft" ? "published" : null;
  if (action === "close") return state === "draft" || state === "published" ? "closed" : null;
  if (state !== "closed") return null;
  return reopenState === "draft" ? "draft" : "published";
}

export function nextJobReopenState(state: JobState, action: JobStatusAction): JobState | null {
  return action === "close" ? state : null;
}
