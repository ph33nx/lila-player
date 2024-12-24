import { ThemeProvider } from "@/components/theme-provider";
import { Space_Mono, Rubik_Mono_One } from "next/font/google";
import "./globals.css";

const rubikMonoOne = Rubik_Mono_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-rubik-mono",
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${rubikMonoOne.variable} ${spaceMono.variable}`}
    >
      <head />
      <body className="bg-background font-sans">
        <div className="fixed inset-0 bg-[radial-gradient(#ffffff33_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none opacity-10" />
        <main>
          <ThemeProvider attribute="class" defaultTheme="dark">
            {children}
          </ThemeProvider>
        </main>
      </body>
    </html>
  );
}
