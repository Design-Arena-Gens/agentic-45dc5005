import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Image to Video",
  description: "Turn still images into MP4 videos directly in your browser."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
