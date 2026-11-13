import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Offline Notes",
    short_name: "Notes",
    description: "Notes that work without internet",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f6f8",
    theme_color: "#4f46e5",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
