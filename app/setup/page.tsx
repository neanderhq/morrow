import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { SetupForm } from "../../components/auth-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasWorkspace } from "../../server/access";

export default async function SetupPage() {
  if (await hasWorkspace()) redirect("/login");
  return <main className="mx-auto grid min-h-screen max-w-5xl items-center gap-8 px-4 py-10 md:grid-cols-[1fr_440px] md:px-8">
    <section className="max-w-xl"><Link href="/" className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Recruiting workspace</Link><div className="mb-5 grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground"><ShieldCheck /></div><p className="mb-2 text-sm font-medium text-primary">A clear home for your hiring team</p><h1 className="text-4xl font-semibold tracking-tight">Set up your workspace</h1><p className="mt-4 max-w-lg leading-7 text-muted-foreground">Create your company workspace and first account. The person who completes setup becomes its first Admin.</p></section>
    <Card className="shadow-sm"><CardHeader><CardTitle>Create your Admin account</CardTitle><CardDescription>Use a work email and a password with at least 12 characters.</CardDescription></CardHeader><CardContent><SetupForm /></CardContent></Card>
  </main>;
}
