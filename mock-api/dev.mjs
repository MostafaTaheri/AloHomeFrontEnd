// Starts the mock API and `next dev` together, already wired to each other, so no .env change is
// needed. Environment variables set here take precedence over .env.local.
//
//   npm run dev:mock                 app on :3000, mock on :5099
//   PORT=3100 MOCK_PORT=5199 npm run dev:mock
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const appPort = process.env.PORT ?? "3000";
const mockPort = process.env.MOCK_PORT ?? "5099";
const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");

const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 500);
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

function run(name, args, env) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  child.on("exit", (code) => {
    if (!stopping) {
      console.log(`[dev:mock] ${name} exited (${code ?? "signal"}), stopping`);
      if (code) {
        console.log(
          "[dev:mock] If another `next dev` or mock is already running for this folder, stop it first" +
            " (Next.js allows one dev server per project), or pick other ports with PORT and MOCK_PORT.",
        );
      }
    }
    stop(code ?? 0);
  });
  children.push(child);
}

run("mock api", ["mock-api/server.mjs"], { PORT: mockPort, HOST: "127.0.0.1" });
run("next dev", [nextBin, "dev", "--port", appPort], {
  API_BASE_URL: `http://127.0.0.1:${mockPort}`,
  COOKIE_SECURE: "false",
});

console.log(
  `[dev:mock] app http://localhost:${appPort}  mock api http://127.0.0.1:${mockPort}\n` +
    "[dev:mock] sign in with code 123456; +989120000000 is the back-office admin",
);
