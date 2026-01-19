import { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Brain Dump Assistant",
  description: "Transform brain dumps into Slack messages and Asana tasks",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export default function BrainDumpLayout({
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
