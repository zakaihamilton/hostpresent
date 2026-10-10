import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Service-worker fetches bypass page routes after the first navigation.
// Keep mocked visual state consistent across both viewport visits.
test.use({ serviceWorkers: "block" });

const sizes = [
  { name: "desktop-1280x800", width: 1280, height: 800 },
  { name: "mobile-390x844", width: 390, height: 844 },
] as const;

test("home page has no WCAG A/AA violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main").first()).toBeVisible();
  await page.evaluate(() => {
    document
      .getAnimations()
      .filter((animation) =>
        Number.isFinite(animation.effect?.getComputedTiming().endTime),
      )
      .forEach((animation) => {
        animation.finish();
      });
  });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("home page matches the reviewed desktop and mobile layouts", async ({
  page,
}) => {
  // Keep the reviewed unsigned-room state independent of server secrets and
  // random room codes. Smoke tests separately cover real room creation.
  await page.route("**/api/rooms/config", (route) =>
    route.fulfill({ json: { roomSigningConfigured: false } }),
  );
  await page.route("**/api/rooms", (route) =>
    route.fulfill({ status: 503, json: { error: "Room signing unavailable" } }),
  );
  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto("/");
    await expect(page.locator("main").first()).toBeVisible();
    await expect(
      page.getByText("[E081] Room signing is not configured."),
    ).toBeVisible();
    await expect(
      page.getByText("[E020] Failed to create room", { exact: true }),
    ).toBeVisible();
    // Match the reviewed layout regardless of macOS scrollbar preferences.
    await page.addStyleTag({
      content:
        "html { scrollbar-gutter: auto !important; scrollbar-width: none !important; } ::-webkit-scrollbar { display: none !important; }",
    });
    await expect(page).toHaveScreenshot(`home-${size.name}.png`, {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
    });
  }
});
