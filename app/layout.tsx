import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import RegisterSW from "./register-sw";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Offline Notes",
  description: "Notes that work without internet",
  appleWebApp: { capable: true, title: "Notes" },
};

export const viewport: Viewport = { themeColor: "#4f46e5" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable}>
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
