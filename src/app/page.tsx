import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { homePathFor } from "@/lib/bff/surface";

export default async function Home() {
  const session = await getSession();
  redirect(session ? homePathFor("client") : "/login");
}
