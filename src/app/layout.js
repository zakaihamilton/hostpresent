import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
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
      </head>
      <body>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
