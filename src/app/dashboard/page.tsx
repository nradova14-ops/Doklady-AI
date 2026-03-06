"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Document } from "@/types/database";

export default function DashboardPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading documents:", error);
    } else {
      setDocuments(data || []);
    }
    setLoading(false);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "processing":
        return (
          <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-700 ring-1 ring-inset ring-yellow-600/20">
            Zpracovává se
          </span>
        );
      case "done":
        return (
          <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
            Hotovo
          </span>
        );
      case "error":
        return (
          <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
            Chyba
          </span>
        );
      default:
        return null;
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("cs-CZ");
  }

  function formatAmount(amount: number | null | undefined, currency: string | null | undefined) {
    if (amount == null) return "—";
    return `${amount.toLocaleString("cs-CZ")} ${currency || "CZK"}`;
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-4">
          <Link href="/dashboard" className="text-xl font-bold text-slate-800">
            Doklady AI
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/upload"
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
            >
              + Nahrát doklad
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Odhlásit se
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h2 className="text-2xl font-semibold text-slate-900 mb-6">
          Moje doklady
        </h2>

        {loading ? (
          <div className="text-center py-12 text-slate-500">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full mb-3" />
            <p>Načítání...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-slate-300 rounded-xl">
            <p className="text-slate-500 mb-4">Zatím nemáte žádné doklady.</p>
            <Link
              href="/upload"
              className="rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
            >
              Nahrát první doklad
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-left text-sm font-medium text-slate-500">
                  <th className="pb-3 pr-4">Soubor</th>
                  <th className="pb-3 pr-4">Typ dokladu</th>
                  <th className="pb-3 pr-4">Dodavatel</th>
                  <th className="pb-3 pr-4">Částka</th>
                  <th className="pb-3 pr-4">Datum</th>
                  <th className="pb-3 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr
                    key={doc.id}
                    onClick={() => router.push(`/documents/${doc.id}`)}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 pr-4 text-sm font-medium text-slate-900">
                      {doc.file_name}
                    </td>
                    <td className="py-3 pr-4 text-sm text-slate-600">
                      {doc.extracted_data?.document_type || "—"}
                    </td>
                    <td className="py-3 pr-4 text-sm text-slate-600">
                      {doc.extracted_data?.supplier?.name || "—"}
                    </td>
                    <td className="py-3 pr-4 text-sm text-slate-600">
                      {formatAmount(
                        doc.extracted_data?.total_amount,
                        doc.extracted_data?.currency
                      )}
                    </td>
                    <td className="py-3 pr-4 text-sm text-slate-600">
                      {formatDate(doc.created_at)}
                    </td>
                    <td className="py-3 pr-4">{getStatusBadge(doc.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
