import { expect, test } from "@playwright/test";

const runWebRtcE2e = process.env.RUN_WEBRTC_E2E === "1";

test.skip(
  !runWebRtcE2e,
  "Set RUN_WEBRTC_E2E=1 with a reachable PeerJS signaling server to run WebRTC E2E.",
);

async function clearClientState(page) {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function createHostMeeting(page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Host Present" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start meeting" }),
  ).toBeEnabled();

  const joinCode = await page
    .locator('[id^="join-code-box-"]')
    .evaluateAll((inputs) => inputs.map((input) => input.value).join(""));

  await page.getByLabel("Your name").fill("Host One");
  await page.getByRole("button", { name: "Start meeting" }).click();
  await expect(
    page.getByRole("button", { name: "Mute microphone" }),
  ).toBeVisible();

  return joinCode;
}

async function joinParticipant(page, joinCode, name) {
  await page.goto(`/#/j/${joinCode}`);
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Join meeting" }).click();
  await expect(
    page.getByRole("button", { name: "Mute microphone" }),
  ).toBeVisible();
}

async function openParticipants(page) {
  const show = page.getByRole("button", { name: "Show participants" });
  if (await show.isVisible()) {
    await show.click();
  }
  await expect(page.getByText("Participants")).toBeVisible();
}

async function openChat(page) {
  const show = page.getByRole("button", { name: "Show chat" });
  if (await show.isVisible()) {
    await show.click();
  }
  await expect(page.getByText("Chat")).toBeVisible();
}

test("host and two participants exchange roster, media, chat, and leave state", async ({
  browser,
}) => {
  const hostContext = await browser.newContext();
  const participantOneContext = await browser.newContext();
  const participantTwoContext = await browser.newContext();

  const host = await hostContext.newPage();
  const participantOne = await participantOneContext.newPage();
  const participantTwo = await participantTwoContext.newPage();

  await Promise.all([
    clearClientState(host),
    clearClientState(participantOne),
    clearClientState(participantTwo),
  ]);

  const joinCode = await createHostMeeting(host);
  await joinParticipant(participantOne, joinCode, "Pat One");
  await joinParticipant(participantTwo, joinCode, "Pat Two");

  await openParticipants(host);
  await expect(host.getByText("Pat One")).toBeVisible();
  await expect(host.getByText("Pat Two")).toBeVisible();
  await expect(
    host.getByRole("button", { name: /Show participants|Hide participants/ }),
  ).toContainText("3");

  await participantOne.getByRole("button", { name: "Turn camera off" }).click();
  await expect(
    participantOne.getByRole("button", { name: "Turn camera on" }),
  ).toBeVisible();

  await openChat(participantOne);
  await participantOne.getByLabel("Chat message").fill("hello from pat one");
  await participantOne.getByRole("button", { name: "Send message" }).click();

  await openChat(host);
  await expect(host.getByText("hello from pat one")).toBeVisible();
  await expect(host.getByText("Pat One")).toBeVisible();

  await participantTwo.getByRole("button", { name: "Leave meeting" }).click();
  await expect(
    participantTwo.getByRole("heading", { name: "Host Present" }),
  ).toBeVisible();
  await expect(host.getByText("Pat Two")).toBeHidden();

  await participantTwoContext.close();
  await participantOneContext.close();
  await hostContext.close();
});
