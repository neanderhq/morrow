import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./globals.css";
import type { ReactNode } from "react";
export const metadata = {
  title: "Morrow | Recruiting workspace",
  description: "A private workspace for your recruiting team.",
};
export const dynamic = "force-dynamic";
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body className="min-h-screen bg-background text-foreground">{children}</body></html>;
}
