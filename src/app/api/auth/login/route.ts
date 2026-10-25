import { handleLogin } from "@/lib/bff/auth-handlers";

export const POST = (request: Request) => handleLogin(request, "client");
