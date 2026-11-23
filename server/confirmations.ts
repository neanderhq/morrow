import type { StaffRole } from "./policy";

const roleLabels: Record<StaffRole, string> = {
  admin: "Admin",
  recruiter: "Recruiter",
  hiring_manager: "Hiring Manager",
  interviewer: "Interviewer",
};

export function staffRoleChangeConfirmation(name: string, currentRole: StaffRole, nextRole: StaffRole) {
  if (currentRole === nextRole) return null;
  const assignmentWarning = currentRole === "hiring_manager" && nextRole !== "hiring_manager"
    ? " Reassign this person's jobs to another Hiring Manager first, or the change will be blocked."
    : "";
  return `Change ${name}'s role to ${roleLabels[nextRole]}?${assignmentWarning}`;
}

export function applicationStageConfirmation(stage: string) {
  if (stage !== "hired" && stage !== "rejected") return null;
  const label = stage === "hired" ? "Hired" : "Rejected";
  return `Move this application to ${label}? This change will be added to its stage history.`;
}

export const noteDeletionConfirmation = "Delete this note? This action cannot be undone.";
