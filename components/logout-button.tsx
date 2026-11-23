"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    router.replace("/login");
    router.refresh();
  }
  return <Button variant="ghost" size="sm" onClick={logout}><LogOut />Log out</Button>;
}
