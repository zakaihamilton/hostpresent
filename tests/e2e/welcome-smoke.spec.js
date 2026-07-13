import { expect, test } from "@playwright/test";

async function readJoinCode(page) {
  const boxes = Array.from({ length: 8 }, (_, index) =>
    page.getByRole("textbox", {
      name: `Character ${index + 1}`,
      exact: true,
    }),
  );
  for (const box of boxes) {
    await expect(box).toBeVisible();
  }
  const readCode = async () =>
    (await Promise.all(boxes.map((box) => box.inputValue()))).join("");
  await expect.poll(readCode).toMatch(/^[A-Z]{8}$/);
  return readCode();
}

test("the app document carries the production browser security policy", async ({
  page,
}) => {
  const response = await page.goto("/");
  expect(response).not.toBeNull();

  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["content-security-policy"]).toContain(
    "connect-src 'self' https: wss:",
  );
  expect(headers["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toBe(
    "camera=(self), microphone=(self), display-capture=(self)",
  );
});

test("host welcome creates a shareable room without joining media", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Host Present" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start meeting" }),
  ).toBeEnabled();

  const joinCode = await readJoinCode(page);
  await expect(page.getByLabel("Invite link")).toHaveValue(
    new RegExp(`#/j/${joinCode.slice(0, 4)}-${joinCode.slice(4)}`),
  );
  await expect(
    page.getByRole("button", { name: "Copy room code" }),
  ).toBeEnabled();
});

test("participant join button stays disabled until a complete code is entered", async ({
  page,
}) => {
  await page.goto("/#/j");
  await expect(page.getByRole("tab", { name: "Participant" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await expect(
    page.getByRole("button", { name: "Join meeting" }),
  ).toBeDisabled();
  await page.locator("#join-code-box-0").fill("A");
  await expect(
    page.getByRole("button", { name: "Join meeting" }),
  ).toBeDisabled();
});

test("invite route joins the participant flow", async ({ page }) => {
  await page.goto("/#/j/ABCD-EFGH");

  await expect(
    page.getByRole("button", { name: "Copy join code ABCD-EFGH" }),
  ).toBeVisible();
  await expect(
    page.getByText("[E011] Waiting for the host to join…"),
  ).toBeVisible();
});

test("recent host room survives reload in local storage", async ({ page }) => {
  await page.goto("/");

  const joinCode = await readJoinCode(page);
  await page.reload();

  await expect(
    page.getByRole("button", { name: "Start meeting" }),
  ).toBeEnabled();
  await expect.poll(async () => readJoinCode(page)).toBe(joinCode);
});
