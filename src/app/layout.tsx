import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Doklady AI — Automatické vytěžování dokladů",
  description:
    "Nahrajte fakturu nebo účtenku a nechte AI vytěžit všechna data automaticky.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs">
      <body className="min-h-screen bg-slate-50 antialiased">{children}</body>
    </html>
  );
}
