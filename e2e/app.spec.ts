import { expect, test, type Page } from "@playwright/test";

const ADMIN_PHONE = "+989120000000";
const RESIDENT_PHONE = "+989121111111";

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
