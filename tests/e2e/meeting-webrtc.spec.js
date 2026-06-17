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

  const joinCodeBoxes = page.getByLabel(/Character \d/);
  await expect
    .poll(async () => {
      const values = await joinCodeBoxes.evaluateAll((inputs) =>
        inputs.map((input) => input.value).join(""),
      );
      return values.replace(/[^a-zA-Z0-9]/g, "");
    })
    .toHaveLength(6);
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

async function joinParticipant(page, joinCode, name) {
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
    page.getByRole("button", { name: "Mute microphone" }),
  ).toBeVisible();
}

async function openParticipants(page) {
  const show = page.getByRole("button", { name: "Show participants" });
  if (await show.isVisible()) {
    await show.click();
  }
  await expect(
    page.getByRole("complementary").filter({ hasText: "Participants" }),
  ).toBeVisible();
}

function participantsList(page) {
  return page.getByLabel("Participants", { exact: true });
}

async function openChat(page) {
  const show = page.getByRole("button", { name: "Show chat" });
  if (await show.isVisible()) {
    await show.click();
  }
  await expect(
    page.getByRole("complementary").filter({ hasText: "Chat" }).last(),
  ).toBeVisible();
}

async function closeParticipants(page) {
  const close = page.getByRole("button", { name: "Close participants" });
  if (await close.isVisible()) {
    await close.click();
  }
  await expect(
    page.getByRole("complementary").filter({ hasText: "Participants" }),
  ).toBeHidden();
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
  await expect(participantsList(host).getByText("Pat One")).toBeVisible();
  await expect(participantsList(host).getByText("Pat Two")).toBeVisible();
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
  await expect(host.getByText("Pat One").first()).toBeVisible();

  await participantTwo.getByRole("button", { name: "Leave meeting" }).click();
  await expect(
    participantTwo.getByRole("heading", { name: "Host Present" }),
  ).toBeVisible();
  await expect(host.getByText("Pat Two")).toBeHidden();

  await participantTwoContext.close();
  await participantOneContext.close();
  await hostContext.close();
});

test("host records locally and focuses participants with auto-focus fallback", async ({
  browser,
}) => {
  const hostContext = await browser.newContext({ acceptDownloads: true });
  const participantOneContext = await browser.newContext();
  const participantTwoContext = await browser.newContext();

  const host = await hostContext.newPage();
  const participantOne = await participantOneContext.newPage();
  const participantTwo = await participantTwoContext.newPage();

  try {
    await Promise.all([
      clearClientState(host),
      clearClientState(participantOne),
      clearClientState(participantTwo),
    ]);

    const joinCode = await createHostMeeting(host);
    await joinParticipant(participantOne, joinCode, "Pat One");
    await joinParticipant(participantTwo, joinCode, "Pat Two");

    await openParticipants(host);
    await expect(participantsList(host).getByText("Pat One")).toBeVisible();
    await expect(participantsList(host).getByText("Pat Two")).toBeVisible();

    await host.getByRole("button", { name: "Focus on Pat One" }).click();
    await expect(
      host.getByRole("button", { name: "Auto-Focus" }),
    ).toBeVisible();

    await closeParticipants(host);
    await expect(host.getByText("Pat One").first()).toBeVisible();
    await expect(participantOne.getByText("Pat One").first()).toBeVisible();
    await expect(participantTwo.getByText("Pat One").first()).toBeVisible();

    await host.getByRole("button", { name: "Start recording" }).click();
    await expect(host.getByText("Recording")).toBeVisible();
    await expect(host.getByText(/^REC$/)).toBeVisible();
    await expect(
      host
        .getByRole("banner")
        .getByText(/\d{2}:\d{2}/)
        .nth(1),
    ).toBeVisible();

    await host.getByRole("button", { name: "Pause recording" }).click();
    await expect(
      host.getByRole("banner").getByText("REC Paused", { exact: true }),
    ).toBeVisible();
    await expect(
      host.getByRole("main").getByText("REC PAUSED", { exact: true }),
    ).toBeVisible();
    await expect(
      host.getByRole("button", { name: "Resume recording" }),
    ).toBeVisible();

    await host.getByRole("button", { name: "Resume recording" }).click();
    await expect(host.getByText("Recording")).toBeVisible();
    await expect(
      host.getByRole("button", { name: "Pause recording" }),
    ).toBeVisible();

    await openParticipants(host);
    await host.getByRole("button", { name: "Auto-Focus" }).click();
    await closeParticipants(host);
    await expect(host.getByText("Host One").first()).toBeVisible({
      timeout: 6_000,
    });

    const downloadPromise = host
      .waitForEvent("download", { timeout: 10_000 })
      .catch(() => null);
    await host.getByRole("button", { name: "Stop and save recording" }).click();
    await expect(
      host.getByText(
        /Stopping recording|Preparing your file|Starting download|Download started/,
      ),
    ).toBeVisible();
    await downloadPromise;
  } finally {
    await Promise.allSettled([
      participantTwoContext.close(),
      participantOneContext.close(),
      hostContext.close(),
    ]);
  }
});
