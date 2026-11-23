import Link from "next/link";
import { redirect } from "next/navigation";
import { BriefcaseBusiness, ClipboardList, LayoutDashboard, ScrollText, Users, UserRound, UserRoundCog } from "lucide-react";
import type { ReactNode } from "react";
import { LogoutButton } from "../../components/logout-button";
import { getMember } from "../../server/access";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", icon: BriefcaseBusiness },
  { href: "/applications", label: "Applications", icon: ClipboardList },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/staff", label: "Staff", icon: UserRoundCog, adminOnly: true },
  { href: "/audit", label: "Audit", icon: ScrollText, adminOnly: true },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export default async function PrivateLayout({ children }: { children: ReactNode }) {
  const member = await getMember();
  if (!member) redirect("/login");
  const links = navigation.filter((item) => !item.adminOnly || member.role === "admin");

  return <div className="min-h-screen md:grid md:grid-cols-[250px_1fr]">
    <aside className="border-b bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r md:px-5 md:py-6">
      <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-0 md:py-0"><Link href="/dashboard" className="flex items-center gap-3 font-semibold"><span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">M</span><span className="leading-tight">Morrow<span className="block text-xs font-normal text-muted-foreground">Recruiting</span></span></Link><div className="md:hidden"><LogoutButton /></div></div>
      <div className="hidden min-w-0 border-b py-5 md:block"><p className="break-words text-sm font-medium [overflow-wrap:anywhere]">{member.workspaceName}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{member.role.replaceAll("_", " ")} workspace</p></div>
      <nav aria-label="Main navigation" className="flex gap-1 overflow-x-auto px-3 pb-3 md:mt-6 md:flex-col md:overflow-visible md:px-0 md:pb-0">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="flex shrink-0 items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Icon className="size-4" />{label}</Link>)}</nav>
      <div className="mt-auto hidden min-w-0 pt-5 md:block"><div className="min-w-0 rounded-lg border bg-background p-3"><p className="break-words text-sm font-medium [overflow-wrap:anywhere]">{member.name}</p><p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">{member.email}</p><div className="mt-3"><LogoutButton /></div></div></div>
    </aside>
    <main className="min-w-0"><header className="hidden min-h-16 flex-wrap items-center justify-between gap-4 border-b px-8 py-3 md:flex"><div className="min-w-0"><p className="text-xs text-muted-foreground">Workspace</p><p className="break-words text-sm font-medium [overflow-wrap:anywhere]">{member.workspaceName}</p></div><div className="flex min-w-0 flex-wrap items-center gap-3"><span className="max-w-48 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">{member.name}</span><LogoutButton /></div></header><div className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 md:px-8 md:py-9">{children}</div></main>
  </div>;
}
