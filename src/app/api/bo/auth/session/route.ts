import { handleSession } from "@/lib/bff/auth-handlers";

export const dynamic = "force-dynamic";

export const GET = () => handleSession("backoffice");
