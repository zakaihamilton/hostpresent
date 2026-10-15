import { expect, test } from "@playwright/test";
import {
  approveSpeaker,
  clearClientState,
  createHostMeeting,
  joinParticipant,
  openParticipants,
} from "./meetingHelpers";

test.use({ trace: "off", video: "off" });

test.skip(
  process.env.RUN_WEBRTC_E2E !== "1",
  "Requires a configured Peerovo test deployment.",
);

async function instrument(page) {
  await clearClientState(page);
  await page.addInitScript(() => {
    window.__audienceCaptureCount = 0;
    window.__audienceCapturedTrackIds = [];
    window.__audienceCapturedTracks = [];
    window.__audiencePCs = [];
    const capture = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = (...args) => {
      window.__audienceCaptureCount += 1;
      return capture(...args).then((stream) => {
        window.__audienceCapturedTracks.push(...stream.getTracks());
        window.__audienceCapturedTrackIds.push(
          ...stream.getTracks().map((track) => track.id),
        );
        return stream;
      });
    };
    const observe = (channel) =>
      channel.addEventListener("message", async (event) => {
        try {
          // PeerJS binary serialization prefixes JSON strings with a length.
          let raw = event.data;
          if (raw instanceof Blob) raw = await raw.arrayBuffer();
          if (raw instanceof ArrayBuffer) {
            const bytes = new Uint8Array(raw);
            const prefix = bytes[0] === 0xd8 ? 3 : bytes[0] === 0xd9 ? 5 : 1;
            raw = new TextDecoder().decode(bytes.subarray(prefix));
          }
          const payload = JSON.parse(raw);
          if (payload.type === "media_plan") window.__audiencePlan = payload;
        } catch {}
      });
    const NativePC = window.RTCPeerConnection;
    window.RTCPeerConnection = class extends NativePC {
      constructor(...args) {
        super(...args);
        window.__audiencePCs.push(this);
        this.addEventListener("datachannel", (event) => observe(event.channel));
      }
      createDataChannel(...args) {
        const channel = super.createDataChannel(...args);
        observe(channel);
        return channel;
      }
    };
  });
}
async function playableFeeds(page, count) {
  const enableSound = page.getByRole("button", {
    name: "Enable sound",
    exact: true,
  });
  if (await enableSound.isVisible()) await enableSound.click();
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            new Set(
              [...document.querySelectorAll("video")]
                .filter(
                  (video) =>
                    video.srcObject && video.readyState >= 2 && !video.paused,
                )
                .map((video) => video.srcObject.id),
            ).size,
        ),
      { timeout: 30_000 },
    )
    .toBeGreaterThanOrEqual(count);
}
async function newMember(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await instrument(page);
  return { context, page };
}

test("listeners forward without capture, grants stop on revoke and host reconnection", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const members = await Promise.all(
    Array.from({ length: 5 }, () => newMember(browser)),
  );
  const [host, ...guests] = members.map((member) => member.page);
  try {
    const code = await createHostMeeting(host);
    for (const [i, guest] of guests.entries())
      await joinParticipant(guest, code, `Guest ${i}`);
    for (const guest of guests)
      expect(await guest.evaluate(() => window.__audienceCaptureCount)).toBe(0);
    for (let i = 0; i < 3; i++)
      await approveSpeaker(host, guests[i], `Guest ${i}`);
    await playableFeeds(guests[3], 4);
    expect(await guests[3].evaluate(() => window.__audienceCaptureCount)).toBe(
      0,
    );
    await guests[3]
      .getByRole("button", { name: "Request to speak", exact: true })
      .click();
    await expect(
      host.getByRole("button", {
        name: "Approve speaking for Guest 3",
        exact: true,
      }),
    ).toBeDisabled();
    await host
      .getByRole("button", {
        name: "Revoke publishing for Guest 0",
        exact: true,
      })
      .click();
    await expect(
      guests[0].getByRole("button", { name: "Request to speak", exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        guests[0].evaluate(
          () =>
            window.__audienceCapturedTracks.filter(
              (track) => track.readyState === "live",
            ).length,
        ),
      )
      .toBe(0);
    await host
      .getByRole("button", {
        name: "Approve speaking for Guest 3",
        exact: true,
      })
      .click();
    await expect(
      guests[3].getByRole("button", { name: "Stop publishing", exact: true }),
    ).toBeVisible();
    const epoch = await guests[1].evaluate(() => window.__audiencePlan.epoch);
    await host.reload();
    await expect
      .poll(() => guests[1].evaluate(() => window.__audiencePlan?.epoch))
      .not.toBe(epoch);
    for (const guest of guests)
      await expect(
        guest.getByRole("button", { name: "Request to speak", exact: true }),
      ).toBeVisible();
    await playableFeeds(guests[0], 1);
  } finally {
    for (const member of members) await member.context.close();
  }
});

test("repairs a departed forwarding parent while preserving separate feeds", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const members = await Promise.all(
    Array.from({ length: 7 }, () => newMember(browser)),
  );
  const [host, ...guests] = members.map((member) => member.page);
  try {
    const code = await createHostMeeting(host);
    for (const [i, guest] of guests.entries())
      await joinParticipant(guest, code, `Relay ${i}`);
    await approveSpeaker(host, guests[0], "Relay 0");
    await playableFeeds(guests[5], 2);
    const plans = await Promise.all(
      guests.map((page) => page.evaluate(() => window.__audiencePlan)),
    );
    const publisher = plans[0].publishers[1];
    const hostId = plans[0].publishers[0];
    const edge = plans
      .flatMap((plan) => plan.edges)
      .find(
        (item) =>
          item.parentId !== hostId &&
          item.parentId !== publisher &&
          item.sourceId === publisher,
      );
    expect(edge).toBeTruthy();
    // Every member's local identity is the child on its host-feed assignment.
    const identities = plans.map(
      (plan) =>
        plan.edges.find(
          (item) =>
            item.sourceId === hostId &&
            item.parentId !== item.childId &&
            item.childId !== hostId,
        )?.childId,
    );
    const parent = identities.indexOf(edge.parentId);
    const viewer = identities.indexOf(edge.childId);
    expect(parent).toBeGreaterThanOrEqual(0);
    expect(viewer).toBeGreaterThanOrEqual(0);
    const started = Date.now();
    await members[parent + 1].context.close();
    await expect
      .poll(
        () =>
          guests[viewer].evaluate(
            ({ source, oldId }) =>
              window.__audiencePlan.edges.find(
                (item) =>
                  item.sourceId === source &&
                  item.id !== oldId &&
                  item.childId !== window.__audiencePlan.publishers[0],
              )?.id,
            { source: publisher, oldId: edge.id },
          ),
        { timeout: 10_000 },
      )
      .toBeTruthy();
    await playableFeeds(guests[viewer], 2);
    expect(Date.now() - started).toBeLessThan(10_000);
  } finally {
    for (const member of members) await member.context.close();
  }
});

test("20-member admission rejects the 21st person", async ({ browser }) => {
  test.skip(
    process.env.RUN_AUDIENCE_CAPACITY_E2E !== "1",
    "Run this test against a deployment with the default 19-attendee capacity.",
  );
  test.setTimeout(240_000);
  const members = [];
  try {
    const host = await newMember(browser);
    members.push(host);
    const code = await createHostMeeting(host.page);
    for (let i = 0; i < 19; i++) {
      const guest = await newMember(browser);
      members.push(guest);
      await joinParticipant(guest.page, code, `Audience ${i}`);
      await expect
        .poll(() => guest.page.evaluate(() => Boolean(window.__audiencePlan)))
        .toBe(true);
      expect(
        await guest.page.evaluate(() => window.__audienceCaptureCount),
      ).toBe(0);
    }
    const excess = await newMember(browser);
    members.push(excess);
    await excess.page.goto(`/#/j/${code}`);
    await expect(
      excess.page.getByText("Meeting is full", { exact: true }),
    ).toBeVisible();
    await openParticipants(host.page);
    await expect(
      host.page.getByRole("button", {
        name: /Show participants|Hide participants/,
      }),
    ).toContainText("20");
    for (const guest of members.slice(1, 20))
      await playableFeeds(guest.page, 1);
  } finally {
    for (const member of members) await member.context.close();
  }
});

test("direct fallback keeps four feeds and focus upgrades the publisher's senders", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const members = await Promise.all(
    Array.from({ length: 5 }, () => newMember(browser)),
  );
  const [host, ...guests] = members.map((member) => member.page);
  try {
    for (const guest of guests)
      await guest.addInitScript(() => {
        const agent = navigator.userAgent;
        Object.defineProperty(navigator, "userAgent", {
          get: () => `${agent} Mobile`,
        });
      });
    const code = await createHostMeeting(host);
    for (const [i, guest] of guests.entries())
      await joinParticipant(guest, code, `Mobile ${i}`);
    for (let i = 0; i < 3; i++)
      await approveSpeaker(host, guests[i], `Mobile ${i}`);
    await playableFeeds(guests[3], 4);
    await expect(
      host.getByText(
        "Direct delivery is increasing your upload load. Video quality may be reduced.",
      ),
    ).toBeVisible();
    await expect(
      guests[3].getByText(
        "Using direct delivery. Video quality may be reduced.",
      ),
    ).toBeVisible();
    await host
      .getByRole("button", { name: "Focus on Mobile 0", exact: true })
      .click();
    await expect
      .poll(() =>
        guests[0].evaluate(() => {
          const senders = window.__audiencePCs
            .flatMap((pc) => pc.getSenders())
            .filter(
              (sender) =>
                sender.track?.kind === "video" &&
                window.__audienceCapturedTrackIds.includes(sender.track.id),
            );
          return (
            senders.length > 0 &&
            senders.every(
              (sender) =>
                sender.getParameters().encodings?.[0]?.maxBitrate === 750_000,
            )
          );
        }),
      )
      .toBe(true);
    await expect
      .poll(() =>
        guests[0].evaluate(() =>
          [...document.querySelectorAll("video")]
            .filter((video) =>
              video.srcObject
                ?.getVideoTracks()
                .some((track) =>
                  window.__audienceCapturedTrackIds.includes(track.id),
                ),
            )
            .every((video) => video.muted),
        ),
      )
      .toBe(true);
    expect(await guests[3].evaluate(() => window.__audienceCaptureCount)).toBe(
      0,
    );
  } finally {
    await Promise.all(members.map((member) => member.context.close()));
  }
});
