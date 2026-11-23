import { redirect } from "next/navigation";
import { getMember, hasWorkspace } from "../server/access";

export default async function Home() {
  const member = await getMember();
  if (member) redirect("/dashboard");
  redirect(await hasWorkspace() ? "/login" : "/setup");
}
