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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://elite-drive-iota.vercel.app"),
  title: {
    default: "Elite Drive | Premium Car Rental Marketplace",
    template: "%s | Elite Drive",
  },
  description:
    "Search approved vehicles, check date availability, request bookings, and manage renter and owner rental workflows with Elite Drive.",
  applicationName: "Elite Drive",
  keywords: ["car rental", "premium car rental", "vehicle marketplace", "vehicle booking", "Ho Chi Minh City", "Elite Drive"],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Elite Drive | Premium Car Rental Marketplace",
    description:
      "Approved vehicle discovery, date-aware availability, booking requests, and owner rental operations in one marketplace.",
    type: "website",
    locale: "en_US",
    siteName: "Elite Drive",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "Elite Drive | Premium Car Rental Marketplace",
    description: "Approved vehicle discovery and rental operations for renters and owners.",
  },
  robots: { index: true, follow: true },
  icons: { icon: "/favicon.ico" },
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
