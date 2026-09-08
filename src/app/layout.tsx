import type { Metadata } from "next";
import MotionProvider from "@/components/motion-provider";
import ThemeProvider from "@/components/theme-provider";
import pkg from "../../package.json";
import { RELEASES_URL, SITE_URL } from "@/utils/site";
import "./globals.css";

const DESCRIPTION =
  "Lila Player is a free, open source desktop app for Windows, macOS and Linux that turns any audio file into a slowed and reverb lofi version, offline.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default:
      "Lila Player: slowed and reverb lofi player for Windows, macOS and Linux",
    template: "%s | Lila Player",
  },
  description: DESCRIPTION,
  applicationName: "Lila Player",
  keywords: [
    "slowed and reverb",
    "slowed + reverb",
    "lofi player",
    "lo-fi",
    "nightcore",
    "vaporwave",
    "daycore",
    "chopped and screwed",
    "vinyl crackle",
    "WAV export",
    "offline audio editor",
    "open source",
    "desktop app",
    "Windows",
    "macOS",
    "Linux",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Lila Player",
    title:
      "Lila Player: slowed and reverb lofi player for Windows, macOS and Linux",
    description: DESCRIPTION,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Lila Player, an open source slowed and reverb lofi audio player, showing a loaded track with its waveform and the speed, reverb, vinyl crackle and volume sliders",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title:
      "Lila Player: slowed and reverb lofi player for Windows, macOS and Linux",
    description: DESCRIPTION,
    images: ["/og.png"],
  },
  icons: {
    icon: [
      { url: "favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "site.webmanifest",
  robots: {
    index: true,
    follow: true,
  },
};

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Lila Player",
  description: DESCRIPTION,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Windows, macOS, Linux",
  softwareVersion: pkg.version,
  url: SITE_URL,
  image: `${SITE_URL}og.png`,
  downloadUrl: RELEASES_URL,
  license: "https://opensource.org/license/mit",
  isAccessibleForFree: true,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(softwareJsonLd).replace(/</g, "\\u003c"),
          }}
        />
        <main>
          <ThemeProvider>
            <MotionProvider>{children}</MotionProvider>
          </ThemeProvider>
        </main>
      </body>
    </html>
  );
}
