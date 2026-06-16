import { ServiceWorkerRegistration } from "@/components/ui/ServiceWorkerRegistration";
import { themeInitScript } from "@/lib/settings/themeScript";
import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://hostpresent.app"),
  title: "Host Present",
  description: "Host presentation and meeting controls",
  applicationName: "Host Present",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Host Present",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "Host Present",
    description: "Host presentation and meeting controls",
    url: "https://hostpresent.app",
    siteName: "Host Present",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/welcome-preview.png",
        width: 1200,
        height: 630,
        alt: "Host Present",
      },
    ],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: Theme bootstrap must run before hydration to avoid a light/dark flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link
          rel="icon"
          type="image/png"
          href="/favicon-96x96.png"
          sizes="96x96"
        />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
