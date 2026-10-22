import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import { SubscriptionProvider } from "@/lib/contexts/SubscriptionContext";
import BottomNav from "@/components/BottomNav";

export const viewport: Viewport = {
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  interactiveWidget: 'resizes-content',
};

export const metadata: Metadata = {
  title: "SubSense",
  description: "AI Subscription Manager",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SubSense",
  },
  formatDetection: { telephone: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="min-h-full bg-gray-50 text-gray-900 antialiased">
        <AuthProvider>
          <SubscriptionProvider>
            {children}
            <BottomNav />
          </SubscriptionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
