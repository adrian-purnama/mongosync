import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MongoSync Local",
  description: "Local-first MongoDB collection copy utility for development.",
  icons: {
    icon: "/assets/full logo.png",
    shortcut: "/assets/full logo.png",
    apple: "/assets/full logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-zinc-100 text-zinc-950">{children}</body>
    </html>
  );
}
