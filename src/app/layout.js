import { ServiceWorkerRegistration } from "@/components/ui/ServiceWorkerRegistration";
import { themeInitScript } from "@/lib/settings/themeScript";
import "./globals.css";

export const metadata = {
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
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
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
