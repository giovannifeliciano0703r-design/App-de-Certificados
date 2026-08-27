import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gerador de Certificados",
  description: "Geração rápida de certificados da SGEx e BADMQGEX para impressão em massa.",
  manifest: "/manifest.webmanifest",
  applicationName: "Gerador de Certificados",
  themeColor: "#111d35",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Certificados",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
