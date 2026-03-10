import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cenovky - Cenové štítky na pivo",
  description: "Aplikace pro tvorbu a tisk cenových štítků na pivo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body className="antialiased">{children}</body>
    </html>
  );
}
