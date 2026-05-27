export default function manifest() {
  return {
    name: "Host Present",
    short_name: "HostPresent",
    description: "Host presentation and meeting controls",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "landscape-primary",
    background_color: "#eef1f6",
    theme_color: "#2563eb",
    categories: ["productivity", "utilities"],
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
