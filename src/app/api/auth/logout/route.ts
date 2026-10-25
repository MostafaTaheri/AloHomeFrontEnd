import { handleLogout } from "@/lib/bff/auth-handlers";

export const POST = (request: Request) => handleLogout(request, "client");
