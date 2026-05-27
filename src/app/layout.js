import "./globals.css";

export const metadata = {
  title: "Host Present",
  description: "Host presentation and meeting controls",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
