import { expect, test, type Page } from "@playwright/test";

/** Breakpoints to exercise header, sidebar rail, and main workspace chrome. */
const VIEWPORTS = [
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
  const header = page.locator("header.app-chrome-header");
  await expect(header).toBeVisible();

  const brandRail = page.locator(".app-chrome-header__brand-rail");
  const sidebarRail = page.locator(".sidebar-icon-rail, aside.sidebar-collapsed-nav").first();

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

  // Brand column matches sidebar icon rail width (w-9 = 2.25rem ≈ 36px).
  expect(brandBox!.width).toBeGreaterThanOrEqual(34);
  expect(brandBox!.width).toBeLessThanOrEqual(38);
  expect(brandBox!.x).toBeLessThanOrEqual(1);

  const logoCenterX = logoBox!.x + logoBox!.width / 2;
  const railCenterX = railBox!.x + railBox!.width / 2;
  expect(Math.abs(logoCenterX - railCenterX), "logo centered over sidebar rail").toBeLessThanOrEqual(4);
}

async function assertHeaderActionsVisible(page: Page) {
  const actions = page.locator(".app-chrome-header__actions");
  await expect(actions).toBeVisible();
  const box = await actions.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize();
  expect(box!.x + box!.width).toBeLessThanOrEqual((viewport?.width ?? 1280) + 1);
}

async function waitForWorkspaceShell(page: Page) {
  await page.goto("/");
  await expect(page).toHaveTitle(/TreeWriter/i);
  await expect(page.locator("header.app-chrome-header")).toBeVisible({ timeout: 30_000 });

  // Give the app a moment to reach the backend before treating API errors as fatal.
  await page.waitForTimeout(1500);
  const errorToast = page.getByText(/Cannot reach API/i);
  if (await errorToast.isVisible().catch(() => false)) {
    const dismiss = page.getByRole("button", { name: /dismiss/i });
    if (await dismiss.isVisible().catch(() => false)) {
      await dismiss.click();
    }
  }

  await expect(
    page.locator(".sidebar-icon-rail, nav[aria-label='Sidebar panels']").first(),
  ).toBeVisible({ timeout: 30_000 });
}

async function assertSidebarPanelNav(page: Page) {
  const panels = page.locator(".sidebar-icon-rail button[aria-label], nav[aria-label='Sidebar panels'] button[aria-label]");
  const count = await panels.count();
  expect(count).toBeGreaterThanOrEqual(4);
}

test.describe("layout chrome across viewports", () => {
  for (const viewport of VIEWPORTS) {
    test(`writer workspace @ ${viewport.name} (${viewport.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await waitForWorkspaceShell(page);

      await assertNoHorizontalOverflow(page);
      await assertHeaderSidebarAlignment(page);
      await assertHeaderActionsVisible(page);
      await assertSidebarPanelNav(page);

      // Main workspace region should remain visible below header.
      const main = page.locator(".workspace-main, .reading-focus-shell__main").first();
      await expect(main).toBeVisible();
      const headerBox = await page.locator("header.app-chrome-header").boundingBox();
      const mainBox = await main.boundingBox();
      expect(headerBox).not.toBeNull();
      expect(mainBox).not.toBeNull();
      expect(mainBox!.y).toBeGreaterThanOrEqual(headerBox!.y);
    });
  }

  test("sidebar panels cycle without overflow on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await waitForWorkspaceShell(page);

    const panelButtons = page.locator(
      ".sidebar-icon-rail button[aria-label]:enabled:not([aria-label*='Git']):not([aria-label*='Theme']):not([aria-label*='Guide']):not([aria-label*='Settings']):not([aria-label*='Pin']):not([aria-label*='Collapse']):not([aria-label*='Terminal']):not([aria-label*='Dispatch'])",
    );
    const count = await panelButtons.count();
    for (let i = 0; i < Math.min(count, 6); i++) {
      await panelButtons.nth(i).click();
      await page.waitForTimeout(200);
      await assertNoHorizontalOverflow(page);
      await assertHeaderSidebarAlignment(page);
    }
  });

  test("assistant panel open does not clip header actions on wide", async ({ page }) => {
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

  test("treewriter-guide section view on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await waitForWorkspaceShell(page);

    // Open Papers panel and navigate to guide if sidebar tree is available.
    const manuscriptsBtn = page.getByRole("button", { name: /Manuscripts|Papers/i }).first();
    if (await manuscriptsBtn.isVisible()) {
      await manuscriptsBtn.click();
    }

    const guideLink = page.getByRole("button", { name: /TreeWriter Guide/i }).first();
    if (await guideLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await guideLink.click();
    }

    await assertNoHorizontalOverflow(page);
    await assertHeaderSidebarAlignment(page);
  });

  test("guide page on tablet", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await waitForWorkspaceShell(page);

    const guideBtn = page.getByRole("button", { name: /Guide|Guide and workspace/i }).last();
    if (await guideBtn.isVisible()) {
      await guideBtn.click();
      await expect(page.getByText(/Guide|TreeWriter Guide/i).first()).toBeVisible({ timeout: 10_000 });
      await assertNoHorizontalOverflow(page);
    }
  });

  test("settings view on tablet", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await waitForWorkspaceShell(page);

    const settingsBtn = page.getByRole("button", { name: /settings/i }).last();
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      await expect(page.getByText(/^Settings$/)).toBeVisible({ timeout: 10_000 });
      await assertNoHorizontalOverflow(page);
    }
  });
});
