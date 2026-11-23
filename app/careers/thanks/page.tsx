import Link from "next/link";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";

export default function ApplicationThanksPage() {
  return <main className="grid min-h-screen place-items-center bg-muted/30 p-5"><Card className="w-full max-w-lg"><CardContent className="grid justify-items-center px-6 py-12 text-center"><div className="grid size-12 place-items-center rounded-full bg-success/10 text-success" aria-hidden="true">✓</div><h1 className="mt-5 text-2xl">Application received</h1><p className="mt-3 text-muted-foreground">Thank you for applying. Your application has been sent to the hiring team.</p><Button asChild className="mt-6"><Link href="/careers">Back to careers</Link></Button></CardContent></Card></main>;
}
