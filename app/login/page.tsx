import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { LoginForm } from "../../components/auth-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMember } from "../../server/access";

export default async function LoginPage() {
  if (await getMember()) redirect("/dashboard");
  return <main className="mx-auto grid min-h-screen max-w-5xl items-center gap-8 px-4 py-10 md:grid-cols-[1fr_440px] md:px-8">
    <section className="max-w-xl"><Link href="/" className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Recruiting workspace</Link><div className="mb-5 grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground"><LockKeyhole /></div><p className="mb-2 text-sm font-medium text-primary">Welcome back</p><h1 className="text-4xl font-semibold tracking-tight">Sign in to your workspace</h1><p className="mt-4 max-w-lg leading-7 text-muted-foreground">Your team’s recruiting work stays private to your company.</p></section>
    <Card className="shadow-sm"><CardHeader><CardTitle>Sign in</CardTitle><CardDescription>Use the email address and password linked to your staff account.</CardDescription></CardHeader><CardContent><LoginForm /></CardContent></Card>
  </main>;
}
