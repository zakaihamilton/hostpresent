import { expect } from "@playwright/test";
import { JOIN_CODE_LENGTH } from "../../src/lib/room/joinCodeFormat.js";

const disableOpfs = process.env.PLAYWRIGHT_DISABLE_OPFS === "1";
export async function clearClientState(page) {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  if (disableOpfs) {
    await page.addInitScript(() => {
      window.__HOSTPRESENT_ENABLE_SERVICE_WORKER__ = true;
      Object.defineProperty(navigator.storage, "getDirectory", {
        configurable: true,
        value: undefined,
      });
    });
  }
}

export async function createHostMeeting(page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Host Present" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start meeting" }),
  ).toBeEnabled();

  const joinCodeBoxes = page.getByLabel(/Character \d/);
  await expect
    .poll(async () => {
      const values = await joinCodeBoxes.evaluateAll((inputs) =>
        inputs.map((input) => input.value).join(""),
      );
      return values.replace(/[^a-zA-Z0-9]/g, "");
    })
    .toHaveLength(JOIN_CODE_LENGTH);
  const joinCode = await joinCodeBoxes.evaluateAll((inputs) =>
    inputs.map((input) => input.value).join(""),
  );

  await page.getByLabel("Your name").fill("Host One");
  await page.getByRole("button", { name: "Start meeting" }).click();
  await expect(
    page.getByRole("button", { name: "Mute microphone" }),
  ).toBeVisible();

  return joinCode;
}

export async function joinParticipant(page, joinCode, name) {
  await page.addInitScript(
    ({ displayName }) => {
      localStorage.setItem("hostpresent.displayName", displayName);
    },
    { displayName: name },
  );
  await page.goto(`/#/j/${joinCode}`);
  const nameField = page.getByLabel("Your name");
  const canFillName = await nameField
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (canFillName) {
    await nameField.fill(name);
    await page.getByRole("button", { name: "Join meeting" }).click();
  }
  await expect(
    page.getByRole("button", { name: "Request to speak", exact: true }),
  ).toBeVisible();
}

export async function approveSpeaker(host, guest, name) {
  await guest
    .getByRole("button", { name: "Request to speak", exact: true })
    .click();
  await openParticipants(host);
  await host
    .getByRole("button", { name: `Approve speaking for ${name}`, exact: true })
    .click();
  await expect(
    guest.getByRole("button", { name: "Mute microphone", exact: true }),
  ).toBeVisible();
}

export async function openParticipants(page) {
  const show = page.getByRole("button", { name: "Show participants" });
  if (await show.isVisible()) {
    await show.click();
  }
  await expect(
    page.getByRole("complementary").filter({ hasText: "Participants" }),
  ).toBeVisible();
}

export function participantsList(page) {
  return page.getByLabel("Participants", { exact: true });
}
