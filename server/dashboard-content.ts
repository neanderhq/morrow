import type { StaffRole } from "./policy";

type DashboardCounts = { jobCount: number; staffCount: number };
type DashboardTask = { title: string; description: string; href: string; complete: boolean };
type DashboardContent = { roleLabel: string; introduction: string; taskDescription: string; tasks: DashboardTask[] };

export function dashboardContent(role: StaffRole, { jobCount, staffCount }: DashboardCounts): DashboardContent {
  const profileTask = { title: "Set up your profile", description: "Make sure your name is up to date.", href: "/profile", complete: true };
  if (role === "admin") return {
    roleLabel: "Admin workspace",
    introduction: "Manage your team, jobs, and recruiting work from one place.",
    taskDescription: "Workspace setup and recruiting work for Admins.",
    tasks: [
      { title: "Build your team", description: "Invite teammates and choose their roles.", href: "/staff", complete: staffCount > 1 },
      profileTask,
      { title: "Manage jobs", description: "Create and maintain your workspace openings.", href: "/jobs", complete: jobCount > 0 },
    ],
  };
  if (role === "recruiter") return {
    roleLabel: "Recruiter workspace",
    introduction: "Manage open roles and keep candidate reviews moving.",
    taskDescription: "Your recruiting work across workspace jobs and applications.",
    tasks: [
      { title: "Manage jobs", description: "Create and maintain workspace openings.", href: "/jobs", complete: jobCount > 0 },
      { title: "Review applications", description: "Keep candidate applications moving through the pipeline.", href: "/applications", complete: false },
      profileTask,
    ],
  };
  if (role === "hiring_manager") return {
    roleLabel: "Hiring manager workspace",
    introduction: "Review hiring work assigned to you and share your decisions.",
    taskDescription: "Your assigned openings and candidate applications.",
    tasks: [
      { title: "Review assigned jobs", description: "Open the jobs assigned to you.", href: "/jobs", complete: jobCount > 0 },
      { title: "Review applications", description: "Share feedback on candidates for your assigned jobs.", href: "/applications", complete: false },
      profileTask,
    ],
  };
  return {
    roleLabel: "Interviewer workspace",
    introduction: "Prepare for interviews with the hiring work assigned to you.",
    taskDescription: "Your assigned openings and interview applications.",
    tasks: [
      { title: "Review assigned jobs", description: "See the openings you are assigned to interview for.", href: "/jobs", complete: jobCount > 0 },
      { title: "Review applications", description: "Prepare for interviews with candidates on your assigned jobs.", href: "/applications", complete: false },
      profileTask,
    ],
  };
}
