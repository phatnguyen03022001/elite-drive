import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/components/provider/AuthProvider";
import { ThemeProvider } from "@/components/provider/ThemeProvider";
import ReactQueryProvider from "@/components/provider/ReactQueryProvider";
import { Toaster } from "sonner";
import { ImageErrorHandler } from "../components/provider/ImageErrorHandler";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  metadataBase: new URL("https://elite-drive-iota.vercel.app"),
  title: {
    default: "Elite Drive | Premium Car Rental Platform",
    template: "%s | Elite Drive",
  },
  description:
    "Discover live vehicle availability, book securely, and manage renter and owner workflows with Elite Drive.",
  applicationName: "Elite Drive",
  keywords: ["car rental", "premium car rental", "vehicle booking", "Ho Chi Minh City", "Elite Drive"],
  openGraph: {
    title: "Elite Drive | Premium Car Rental Platform",
    description: "Live vehicle discovery, authenticated bookings, and owner fleet operations in one platform.",
    type: "website",
    locale: "en_US",
    siteName: "Elite Drive",
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans antialiased", inter.variable)}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <ReactQueryProvider>
            <AuthProvider>
              {children}
              <ImageErrorHandler />
              <Toaster richColors position="bottom-right" />
            </AuthProvider>
          </ReactQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
