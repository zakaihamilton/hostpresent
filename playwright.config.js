import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT || "3000";
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${PORT}`;
const { FORCE_COLOR: _forceColor, NO_COLOR: _noColor, ...cleanEnv } =
  process.env;
const crossBrowserProjects = [
  ...(process.env.PLAYWRIGHT_CROSS_BROWSER
    ? [
        {
          name: "firefox",
          use: {
            ...devices["Desktop Firefox"],
            permissions: [],
            launchOptions: {
              firefoxUserPrefs: {
                "media.navigator.permission.disabled": true,
                "media.navigator.streams.fake": true,
              },
            },
          },
        },
      ]
    : []),
  ...(process.env.PLAYWRIGHT_WEBKIT
    ? [
        {
          name: "webkit",
          use: {
            ...devices["Desktop Safari"],
            permissions: [],
          },
        },
      ]
    : []),
];

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    permissions: ["camera", "microphone"],
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--auto-select-desktop-capture-source=Entire screen",
        "--enable-usermedia-screen-capturing",
      ],
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    ...crossBrowserProjects,
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEB_SERVER
    ? undefined
    : {
        command: `npm run dev -- -H 127.0.0.1 -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          ...cleanEnv,
          NEXT_PUBLIC_APP_URL: baseURL,
          ROOM_TOKEN_SECRET:
            process.env.ROOM_TOKEN_SECRET ||
            "playwright-local-room-token-secret",
        },
      },
});
