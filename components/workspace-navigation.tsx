"use client";

import { BriefcaseBusiness, ClipboardList, LayoutDashboard, ScrollText, Users, UserRound, UserRoundCog } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", icon: BriefcaseBusiness },
  { href: "/applications", label: "Applications", icon: ClipboardList },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/staff", label: "Staff", icon: UserRoundCog, adminOnly: true },
  { href: "/audit", label: "Audit", icon: ScrollText, adminOnly: true },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export function WorkspaceNavigation({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className="grid grid-cols-2 gap-1 px-3 pb-3 min-[360px]:grid-cols-3 md:mt-6 md:grid-cols-1 md:px-0 md:pb-0">
      {navigation.filter(({ adminOnly }) => !adminOnly || isAdmin).map(({ href, label, icon: Icon }) => {
        const current = pathname === href ? "page" : pathname.startsWith(href + "/") ? "location" : undefined;
        return (
          <Link
            key={href}
            href={href}
            aria-current={current}
            className="flex min-h-10 min-w-0 items-center gap-1.5 rounded-md px-2 py-2 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current]:bg-sidebar-accent aria-[current]:font-semibold aria-[current]:text-sidebar-accent-foreground md:gap-3 md:px-3 md:text-sm"
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
