import { expect, test, type Page } from "@playwright/test";

/** Breakpoints to exercise header, sidebar rail, and main workspace chrome. */
const VIEWPORTS = [
  { name: "mobile-320", width: 320, height: 568 },
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide", width: 1440, height: 900 },
] as const;

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  expect(overflow, "document horizontal overflow").toBeLessThanOrEqual(1);
}

async function assertHeaderSidebarAlignment(page: Page) {
  const brandRail = page.locator(".app-chrome-header__brand-rail");
  const sidebarRail = page.locator(".sidebar-collapsed-nav").first();

  await expect(brandRail).toBeVisible();
  await expect(sidebarRail).toBeVisible();

  const [brandBox, railBox, logoBox] = await Promise.all([
    brandRail.boundingBox(),
    sidebarRail.boundingBox(),
    brandRail.locator("img").first().boundingBox(),
  ]);

  expect(brandBox).not.toBeNull();
  expect(railBox).not.toBeNull();
  expect(logoBox).not.toBeNull();

  expect(brandBox!.width).toBeGreaterThanOrEqual(34);
  expect(brandBox!.width).toBeLessThanOrEqual(38);
  expect(brandBox!.x).toBeLessThanOrEqual(1);

  const logoCenterX = logoBox!.x + logoBox!.width / 2;
  const railCenterX = railBox!.x + railBox!.width / 2;
  expect(Math.abs(logoCenterX - railCenterX), "logo centered over sidebar rail").toBeLessThanOrEqual(6);
}

async function assertHeaderActionsVisible(page: Page) {
  const actions = page.locator(".app-chrome-header__actions");
  await expect(actions).toBeVisible();
  const box = await actions.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize();
  expect(box!.x + box!.width).toBeLessThanOrEqual((viewport?.width ?? 1280) + 2);
}

async function waitForWorkspaceShell(page: Page) {
  await page.goto("/");
  await expect(page).toHaveTitle(/TreeWriter/i);
  await expect(page.locator("header.app-chrome-header")).toBeVisible({ timeout: 30_000 });

  await page.waitForTimeout(1500);
  const errorToast = page.getByText(/Cannot reach API/i);
  if (await errorToast.isVisible().catch(() => false)) {
    const dismiss = page.getByRole("button", { name: /dismiss/i });
    if (await dismiss.isVisible().catch(() => false)) {
      await dismiss.click();
    }
  }

  await expect(
    page.locator(".sidebar-collapsed-nav, nav[aria-label='Sidebar panels']").first(),
  ).toBeVisible({ timeout: 30_000 });
}

test.describe("layout chrome across viewports", () => {
  for (const viewport of VIEWPORTS) {
    test(`writer workspace @ ${viewport.name} (${viewport.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await waitForWorkspaceShell(page);

      await assertNoHorizontalOverflow(page);
      await assertHeaderSidebarAlignment(page);
      await assertHeaderActionsVisible(page);

      const main = page.locator(".workspace-main, .reading-focus-shell__main").first();
      await expect(main).toBeVisible();
    });
  }

  test("assistant panel open keeps header actions on the right", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await waitForWorkspaceShell(page);

    const aiToggle = page.getByRole("button", { name: /assistant panel/i });
    if (await aiToggle.isVisible()) {
      await aiToggle.click();
      await page.waitForTimeout(400);
      await assertNoHorizontalOverflow(page);
      await assertHeaderActionsVisible(page);
    }
  });
});
