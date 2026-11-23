// F8: signup needs the 18+ / Terms box. Unticked: the form refuses and no sign-in email is sent. Ticked: it goes through
// and the server records profiles.accepted_terms_at (/auth/callback, service role). Supabase is the in-app mock.
import { expect, test } from "@playwright/test";

test("signup: the 18+ and Terms box is required and recorded", async ({ page }) => {
  test.setTimeout(240_000);
  const email = `age-${Date.now()}@example.com`;
  await page.goto("/signup?next=/account");
  await expect(async () => {
    await page.getByRole("tab", { name: "Email link" }).click();
    await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.getByText(/18 or older/i).first()).toBeVisible();

  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("checkbox")).toHaveAttribute("required", "");   // the browser blocks the submit
  await expect(page.getByRole("heading", { name: "Check your email" })).toHaveCount(0);
  const none = await (await page.request.get(`/e2e-mock/supabase/_inbox?email=${encodeURIComponent(email)}`)).json();
  expect(none.url).toBeNull();

  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible({ timeout: 30_000 });
  const { url } = await (await page.request.get(`/e2e-mock/supabase/_inbox?email=${encodeURIComponent(email)}`)).json();
  await page.goto(url);
  await expect(async () => {
    if (new URL(page.url()).pathname === "/onboarding") await page.getByRole("button", { name: "Skip setup" }).click({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/account$/, { timeout: 10_000 });
  }).toPass({ timeout: 90_000 });
  // the account export carries the profile, including when the terms were accepted
  const exp = await (await page.request.get("/api/account/export")).text();
  expect(exp).toMatch(/accepted_terms_at/);
});
