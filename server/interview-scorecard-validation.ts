export const interviewRecommendations = [
  { value: "advance", label: "Advance" },
  { value: "debrief", label: "Discuss at debrief" },
  { value: "decline", label: "Decline" },
] as const;

export function parseJobCriteria(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > 8) return null;
  if (!value.every((entry) => typeof entry === "string")) return null;
  const criteria = value.map((entry: string) => entry.trim());
  if (criteria.some((entry) => entry.length < 2 || entry.length > 120 || /[\r\n]/.test(entry))) return null;
  return new Set(criteria.map((entry) => entry.toLowerCase())).size === criteria.length ? criteria : null;
}

export function parseInterviewFeedback(body: Record<string, unknown>, count: number, submit: boolean) {
  const { ratings, notes, recommendation } = body;
  if (!Array.isArray(ratings) || ratings.length !== count ||
      !ratings.every((rating) => rating === null ||
        (Number.isInteger(rating) && rating >= 1 && rating <= 5))) return null;
  if (typeof notes !== "string" || notes.trim().length > 2000 || notes.includes("\0")) return null;
  if (recommendation !== "" && !interviewRecommendations.some((option) => option.value === recommendation)) return null;
  if (submit && (ratings.includes(null) || !notes.trim() || !recommendation)) return null;
  return { ratings: ratings as (number | null)[], notes: notes.trim(), recommendation: recommendation as string };
}
