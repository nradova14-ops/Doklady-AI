"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Document } from "@/types/database";

export default function DashboardPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [radaReceived, setRadaReceived] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("money_rada_received") || "";
    return "";
  });
  const [radaIssued, setRadaIssued] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("money_rada_issued") || "";
    return "";
  });
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  // Close export menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    }
    if (exportMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [exportMenuOpen]);

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

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === documents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(documents.map((d) => d.id)));
    }
  }

  async function handleExport(type: "received" | "issued" | "all") {
    setExportMenuOpen(false);
    localStorage.setItem("money_rada_received", radaReceived);
    localStorage.setItem("money_rada_issued", radaIssued);
    setExporting(true);
    try {
      const res = await fetch("/api/documents/export/money-s3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_ids: Array.from(selectedIds),
          type,
          rada_received: radaReceived,
          rada_issued: radaIssued,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Export se nezdařil.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ||
        "money-s3-export.xml";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Chyba při exportu.");
    } finally {
      setExporting(false);
    }
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
            <Link
              href="/settings"
              className="rounded-lg border border-slate-300 px-3 py-2 text-slate-600 hover:bg-slate-50 transition-colors"
              title="Nastavení"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
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

        {/* Export toolbar */}
        {selectedIds.size > 0 && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-sm font-medium text-slate-700">
              {selectedIds.size} {selectedIds.size === 1 ? "vybrán" : selectedIds.size < 5 ? "vybrány" : "vybráno"}
            </span>

            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                disabled={exporting}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {exporting ? "Exportuji..." : "Exportovat do Money S3"}
                {!exporting && (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              {exportMenuOpen && (
                <div className="absolute left-0 top-full mt-1 w-64 rounded-lg border border-slate-200 bg-white py-1 shadow-lg z-10">
                  <div className="px-4 py-2 space-y-2">
                    <label className="block text-xs font-medium text-slate-500">
                      Číselná řada - přijaté
                      <input
                        type="text"
                        value={radaReceived}
                        onChange={(e) => setRadaReceived(e.target.value)}
                        placeholder="např. FP"
                        className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                      />
                    </label>
                    <label className="block text-xs font-medium text-slate-500">
                      Číselná řada - vydané
                      <input
                        type="text"
                        value={radaIssued}
                        onChange={(e) => setRadaIssued(e.target.value)}
                        placeholder="např. FV"
                        className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                      />
                    </label>
                  </div>
                  <div className="border-t border-slate-100 my-1" />
                  <button
                    onClick={() => handleExport("received")}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Přijaté faktury (PF)
                  </button>
                  <button
                    onClick={() => handleExport("issued")}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Vydané faktury (VF)
                  </button>
                  <div className="border-t border-slate-100 my-1" />
                  <button
                    onClick={() => handleExport("all")}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Vše
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedIds(new Set())}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-white transition-colors"
            >
              Odznačit vše
            </button>
          </div>
        )}

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
                  <th className="pb-3 pr-2 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === documents.length && documents.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-slate-800 focus:ring-slate-400 h-4 w-4 cursor-pointer"
                    />
                  </th>
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
                    className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                      selectedIds.has(doc.id) ? "bg-slate-50" : ""
                    }`}
                  >
                    <td className="py-3 pr-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(doc.id)}
                        onChange={() => toggleSelect(doc.id)}
                        className="rounded border-slate-300 text-slate-800 focus:ring-slate-400 h-4 w-4 cursor-pointer"
                      />
                    </td>
                    <td
                      className="py-3 pr-4 text-sm font-medium text-slate-900 cursor-pointer"
                      onClick={() => router.push(`/documents/${doc.id}`)}
                    >
                      {doc.file_name}
                    </td>
                    <td
                      className="py-3 pr-4 text-sm text-slate-600 cursor-pointer"
                      onClick={() => router.push(`/documents/${doc.id}`)}
                    >
                      {doc.extracted_data?.document_type || "—"}
                    </td>
                    <td
                      className="py-3 pr-4 text-sm text-slate-600 cursor-pointer"
                      onClick={() => router.push(`/documents/${doc.id}`)}
                    >
                      {doc.extracted_data?.supplier?.name || "—"}
                    </td>
                    <td
                      className="py-3 pr-4 text-sm text-slate-600 cursor-pointer"
                      onClick={() => router.push(`/documents/${doc.id}`)}
                    >
                      {formatAmount(
                        doc.extracted_data?.total_amount,
                        doc.extracted_data?.currency
                      )}
                    </td>
                    <td
                      className="py-3 pr-4 text-sm text-slate-600 cursor-pointer"
                      onClick={() => router.push(`/documents/${doc.id}`)}
                    >
                      {formatDate(doc.created_at)}
                    </td>
                    <td
                      className="py-3 pr-4 cursor-pointer"
                      onClick={() => router.push(`/documents/${doc.id}`)}
                    >
                      {getStatusBadge(doc.status)}
                    </td>
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
