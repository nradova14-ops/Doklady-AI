import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Doklady AI — Automatické vytěžování faktur pro živnostníky",
  description:
    "Nahrajte fakturu nebo ji pošlete emailem. AI vytěží data a rovnou je odešle do Fakturoidu. Zdarma pro 5 dokladů měsíčně.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs">
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-white antialiased">{children}</body>
    </html>
  );
}
