import { expect, test } from "@playwright/test";

async function readJoinCode(page) {
  const boxes = Array.from({ length: 9 }, (_, index) =>
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
  await expect.poll(readCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ0-9]{9}$/);
  return readCode();
}

test("the app document carries the production browser security policy", async ({
  page,
}) => {
  const response = await page.goto("/");
  expect(response).not.toBeNull();

  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  const csp = headers["content-security-policy"];
  const connectSrc = csp
    .split("; ")
    .find((part) => part.startsWith("connect-src "));
  if (process.env.PLAYWRIGHT_SERVER_MODE === "production") {
    expect(connectSrc).toBe("connect-src 'self' https: wss:");
    expect(csp).not.toContain("'unsafe-eval'");
  } else {
    expect(connectSrc).toBe(
      "connect-src 'self' https: wss: http://127.0.0.1:9000 ws://127.0.0.1:9000 http://localhost:9000 ws://localhost:9000",
    );
    expect(csp).toContain("'unsafe-eval'");
  }
  expect(csp).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
  expect(csp).toContain("'strict-dynamic'");
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
  const formattedJoinCode = joinCode.replace(/(.{3})(?=.)/g, "$1-");
  await expect(page.getByLabel("Invite link")).toHaveValue(
    new RegExp(`#/j/${formattedJoinCode}`),
  );
  await expect(
    page.getByRole("button", { name: "Copy room code" }),
  ).toBeEnabled();
});

test("participant accepts nine-character mixed codes", async ({ page }) => {
  await page.goto("/#/j");
  await expect(page.getByRole("tab", { name: "Participant" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await expect(
    page.getByRole("button", { name: "Join meeting" }),
  ).toBeDisabled();
  for (const [index, character] of Array.from("ABC123DE").entries()) {
    await page
      .getByRole("textbox", {
        name: `Character ${index + 1}`,
        exact: true,
      })
      .fill(character);
  }
  await expect(
    page.getByRole("button", { name: "Join meeting" }),
  ).toBeDisabled();

  await page
    .getByRole("textbox", { name: "Character 9", exact: true })
    .fill("F");
  await expect(
    page.getByRole("button", { name: "Join meeting" }),
  ).toBeEnabled();
});

test("invite route joins the participant flow", async ({ page }) => {
  const resolveResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/rooms/resolve" &&
      response.request().method() === "POST",
  );

  await page.goto("/#/j/ABC-123-DEF");

  expect((await resolveResponse).ok()).toBe(true);
  await expect(page).toHaveURL(/#\/mj\/ABC-123-DEF$/);
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
