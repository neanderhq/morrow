export const staffRoles = ["admin", "recruiter", "hiring_manager", "interviewer"] as const;
export type StaffRole = (typeof staffRoles)[number];
export const applicationStages = ["applied", "screening", "interview", "offer", "hired", "rejected"] as const;
export type ApplicationStage = (typeof applicationStages)[number];

export function isApplicationStage(value: unknown): value is ApplicationStage {
  return typeof value === "string" && applicationStages.includes(value as ApplicationStage);
}

export function validRole(role: unknown): role is StaffRole {
  return typeof role === "string" && staffRoles.includes(role as StaffRole);
}

export function canManageStaff(role: StaffRole) {
  return role === "admin";
}

export function canReactivateStaff(role: StaffRole) {
  return role === "admin";
}

export function requiresHiringManagerReassignment(previousRole: StaffRole, nextRole: StaffRole, assignedJobCount: number) {
  return previousRole === "hiring_manager" && nextRole !== "hiring_manager" && assignedJobCount > 0;
}

export function wouldDeactivateLastActiveAdmin(role: StaffRole, active: boolean, activeAdminCount: number) {
  return role === "admin" && active && activeAdminCount <= 1;
}

export function canManageJobs(role: StaffRole) {
  return role === "admin" || role === "recruiter";
}

export function isHiringManagerAssignment(role: StaffRole, userId: string, hiringManagerId: string | null) {
  return role === "hiring_manager" && userId === hiringManagerId;
}

export function canViewAllApplications(role: StaffRole) {
  return canManageJobs(role);
}

export function canChangeApplicationStage(role: StaffRole, hasAssignedJob: boolean) {
  return canManageJobs(role) || (role === "hiring_manager" && hasAssignedJob);
}

export function canDeleteApplicationNote(role: StaffRole, actorUserId: string, authorUserId: string) {
  return role === "admin" || actorUserId === authorUserId;
}

export function validEmploymentType(value: unknown): value is "full_time" | "part_time" | "contract" {
  return value === "full_time" || value === "part_time" || value === "contract";
}

export function validPassword(password: string) {
  return password.length >= 12 && password.length <= 128;
}

export function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
