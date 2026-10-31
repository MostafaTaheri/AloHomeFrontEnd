import { expect, test, type Page } from "@playwright/test";

const ADMIN_PHONE = "+989120000000";
const RESIDENT_PHONE = "+989121111111";
const TREASURER_PHONE = "+61400000002";
const ANALYST_PHONE = "+61400000003";

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: "alohome-locale", value: "en", url: "http://127.0.0.1:3100" }]);
});

async function signIn(page: Page, loginPath: string, phone: string, code = "123456") {
  await page.goto(loginPath);
  await page.getByLabel("Phone number").fill(phone);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByLabel("Verification code").fill(code);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

const clientSignIn = (page: Page, phone: string, code?: string) =>
  signIn(page, "/login", phone, code);
const backofficeSignIn = (page: Page, phone: string, code?: string) =>
  signIn(page, "/backoffice/login", phone, code);

test.describe("route protection", () => {
  test("sends anonymous visitors to the client login and remembers the target", async ({
    page,
  }) => {
    await page.goto("/schemes/1");
    await expect(page).toHaveURL(/\/login\?next=%2Fschemes%2F1/);
  });

  test("sends anonymous visitors of the back office to the separate staff login", async ({
    page,
  }) => {
    await page.goto("/backoffice/schemes");
    await expect(page).toHaveURL(/\/backoffice\/login\?next=%2Fbackoffice%2Fschemes/);
    await expect(page.getByRole("heading", { name: "Back office sign-in" })).toBeVisible();
  });

  test("keeps the old /admin and /dashboard URLs working", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/backoffice\/login/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("ships a CSP with a per-request nonce and no unsafe-eval", async ({ request }) => {
    const response = await request.get("/login");
    const csp = response.headers()["content-security-policy"] ?? "";
    expect(csp).toContain("nonce-");
    expect(csp).not.toContain("unsafe-eval");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
  });

  test("rejects mutating API calls without a same-origin Origin header", async ({ request }) => {
    for (const path of ["/api/auth/request-otp", "/api/bo/auth/request-otp"]) {
      const response = await request.post(path, {
        data: { phoneNumber: ADMIN_PHONE },
        headers: { origin: "https://evil.example" },
      });
      expect(response.status()).toBe(403);
    }
  });
});

test.describe("client sign in", () => {
  test("validates the phone number before calling the API", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Phone number").fill("0912");
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByText(/valid phone number/i)).toBeVisible();
  });

  test("shows the API's message for a wrong code", async ({ page }) => {
    await clientSignIn(page, RESIDENT_PHONE, "000000");
    await expect(page.getByText("The code is invalid or has expired.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("a manager picks a scheme and sees its financial health", async ({ page }) => {
    await clientSignIn(page, RESIDENT_PHONE);
    await expect(page).toHaveURL(/\/schemes/);
    await expect(page.getByText("Harbour View")).toBeVisible();
    await expect(page.getByText("Tower A")).toBeVisible();

    await page
      .getByRole("link", { name: /Harbour View/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/schemes\/1/);
    await expect(page.getByText(/A\$|AUD/).first()).toBeVisible();
  });

  test("a client session cannot open the back office", async ({ page }) => {
    await clientSignIn(page, RESIDENT_PHONE);
    await expect(page).toHaveURL(/\/schemes/);
    await page.goto("/backoffice");
    await expect(page).toHaveURL(/\/backoffice\/login/);
  });

  test("signing out ends the session", async ({ page }) => {
    await clientSignIn(page, RESIDENT_PHONE);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/schemes");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("back office", () => {
  test("a staff account without the Admin role is refused", async ({ page }) => {
    await backofficeSignIn(page, RESIDENT_PHONE);
    await expect(page.getByText("This account doesn't have back-office access.")).toBeVisible();
    await expect(page).toHaveURL(/\/backoffice\/(login|forbidden)/);
  });

  test("an admin signs in separately and browses schemes", async ({ page }) => {
    await backofficeSignIn(page, ADMIN_PHONE);
    await expect(page).toHaveURL(/\/backoffice/);
    await expect(page).not.toHaveURL(/\/login/);

    await page.goto("/backoffice/schemes");
    await expect(page.getByRole("heading", { name: "Schemes" })).toBeVisible();
    await expect(page.getByText("Harbour View")).toBeVisible();
    await expect(page.getByText("Tower A")).toBeVisible();
  });

  test("a back-office session does not grant a client session", async ({ page }) => {
    await backofficeSignIn(page, ADMIN_PHONE);
    await expect(page).not.toHaveURL(/\/login/);
    await page.goto("/schemes");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("every page renders against the mock API", () => {
  const SCHEME_PAGES = [
    "",
    "/imports",
    "/expenses",
    "/expenses?tab=flags",
    "/arrears",
    "/arrears?tab=risk",
    "/arrears?tab=actions",
    "/arrears?tab=reminders",
    "/arrears?tab=settings",
    "/capital-works",
    "/capital-works?tab=scenarios",
    "/ai-review",
    "/ai-review?tab=suggestions",
    "/ai-review?tab=documents",
    "/ai-review?tab=ask",
    "/reports",
    "/budgets",
    "/budgets?tab=actual",
    "/budgets?tab=variance",
    "/property",
    "/property?tab=committee",
    "/audit",
    "/glossary",
    "/feedback",
  ];
  const BACKOFFICE_PAGES = [
    "/backoffice",
    "/backoffice/schemes",
    "/backoffice/schemes/1",
    "/backoffice/users",
    "/backoffice/access-log",
    "/backoffice/pilot",
    "/backoffice/schemes/1?tab=case-study",
    "/backoffice/organisations",
    "/backoffice/organisations/1",
    "/backoffice/audit-log",
    "/backoffice/evidence",
    "/backoffice/product",
  ];

  async function expectRenders(page: Page, path: string) {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
    expect(errors, `uncaught errors on ${path}`).toEqual([]);
  }

  test("client pages for both markets", async ({ page }) => {
    test.setTimeout(120_000);
    await clientSignIn(page, RESIDENT_PHONE);
    await expect(page).toHaveURL(/\/schemes/);
    for (const id of [1, 2]) {
      for (const path of SCHEME_PAGES) await expectRenders(page, `/schemes/${id}${path}`);
    }
    await expectRenders(page, "/schemes/portfolio");
  });

  test("back-office pages", async ({ page }) => {
    await backofficeSignIn(page, ADMIN_PHONE);
    await expect(page).not.toHaveURL(/\/login/);
    for (const path of BACKOFFICE_PAGES) await expectRenders(page, path);
  });
});

/** Signs in and waits for the scheme picker, so a following goto isn't overtaken by the redirect. */
async function signedIn(page: Page, phone: string) {
  await clientSignIn(page, phone);
  await page.waitForURL(/\/schemes$/);
}

test.describe("post-MVP journeys", () => {
  test("a manager approves the draft budget", async ({ page }) => {
    await signedIn(page, "+61411111111");
    await page.goto("/schemes/1/budgets");
    await page.getByRole("button", { name: /Mid-year revision/ }).click();
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await page.getByLabel("Approval reference").fill("Committee meeting, motion 2");
    await page.getByRole("dialog").getByRole("button", { name: "Approve", exact: true }).click();
    await page
      .getByRole("dialog", { name: /Approve “Mid-year revision”/ })
      .getByRole("button", { name: "Approve", exact: true })
      .click();
    await expect(page.getByText("Budget approved.")).toBeVisible();
  });

  test("reminders need a second person to approve them", async ({ page }) => {
    // The seeded batch was drafted by the treasurer.
    await signedIn(page, TREASURER_PHONE);
    await page.goto("/schemes/1/arrears?tab=reminders");
    await page.getByRole("button", { name: "Approve and send" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Approve and send" }).click();
    await expect(page.getByText(/someone else must approve it/)).toBeVisible();

    await page.context().clearCookies();
    await page
      .context()
      .addCookies([{ name: "alohome-locale", value: "en", url: "http://127.0.0.1:3100" }]);
    await signedIn(page, "+61411111111");
    await page.goto("/schemes/1/arrears?tab=reminders");
    await page.getByRole("button", { name: "Approve and send" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Approve and send" }).click();
    await expect(page.getByText("Batch approved. Reminders are on their way.")).toBeVisible();
  });

  test("a question is answered from verified data", async ({ page }) => {
    await signedIn(page, "+61411111111");
    await page.goto("/schemes/1/ai-review?tab=ask");
    await page.getByLabel("Your question").fill("Who are our top suppliers this year?");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByText("Answered", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Records used/ })).toBeVisible();
  });

  test("ownership transfer requires shares that add up to 100%", async ({ page }) => {
    await signedIn(page, "+61411111111");
    await page.goto("/schemes/1/property");
    await page.getByRole("button", { name: "Owners and history" }).nth(3).click();
    await page.getByRole("button", { name: "Transfer ownership" }).click();
    await page.getByLabel("Effective date").fill("2026-10-15");
    await page.getByLabel("Name or user ID").fill("New Owner");
    await page.getByLabel("Share %").fill("90");
    await page.getByRole("button", { name: "Review transfer" }).click();
    await expect(page.getByText("Total 90%")).toBeVisible();
    await page.getByLabel("Share %").fill("100");
    await page.getByRole("button", { name: "Review transfer" }).click();
    await expect(page.getByRole("heading", { name: "Record this transfer?" })).toBeVisible();
  });

  test("an analyst can view but not change data or see the audit log", async ({ page }) => {
    await signedIn(page, ANALYST_PHONE);
    await page.goto("/schemes/1");
    await expect(page.getByText("Your role: Analyst")).toBeVisible();
    await expect(page.getByRole("link", { name: "Audit log" })).toHaveCount(0);
    await page.goto("/schemes/1/audit");
    await expect(page.getByText("Your role can't view the audit log")).toBeVisible();
    await page.goto("/schemes/1/budgets");
    await expect(page.getByRole("button", { name: "New budget" })).toHaveCount(0);
  });
});
