import { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Voice Email Assistant",
  description: "Compose and send emails using your voice",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export default function VoiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Mobile-optimized layout without sidebar
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
