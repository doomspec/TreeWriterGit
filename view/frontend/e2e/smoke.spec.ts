import { expect, test } from "@playwright/test";

test("loads TreeWriter shell and backend health", async ({ page, request }) => {
  const health = await request.get("http://127.0.0.1:4000/health");
  expect(health.ok()).toBeTruthy();
  const healthBody = await health.json();
  expect(healthBody.ok).toBe(true);

  await page.goto("/");
  await expect(page).toHaveTitle(/TreeWriter/i);
  await expect(page.locator("body")).toBeVisible();
});
