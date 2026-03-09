"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Document, ExtractedData } from "@/types/database";

export default function DocumentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [doc, setDoc] = useState<Document | null>(null);
  const [formData, setFormData] = useState<ExtractedData | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sendingToFakturoid, setSendingToFakturoid] = useState(false);
  const [sendingToIdoklad, setSendingToIdoklad] = useState(false);
  const [message, setMessage] = useState("");
  const [aresLoading, setAresLoading] = useState(false);
  const [aresResult, setAresResult] = useState<{
    ico: string;
    name: string;
    dic: string | null;
    address: string;
    city: string;
    zip: string;
  } | null>(null);
  const [showAresModal, setShowAresModal] = useState(false);

  const loadDocument = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      router.push("/dashboard");
      return;
    }

    setDoc(data);
    if (data.extracted_data) {
      setFormData(data.extracted_data);
    }

    // Get signed URL for file preview
    const { data: urlData } = await supabase.storage
      .from("documents")
      .createSignedUrl(data.file_url, 3600);

    if (urlData?.signedUrl) {
      setFileUrl(urlData.signedUrl);
    }

    setLoading(false);
    return data;
  }, [id, router]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  // Poll while processing
  useEffect(() => {
    if (!doc || doc.status !== "processing") return;

    const interval = setInterval(async () => {
      const updated = await loadDocument();
      if (updated && updated.status !== "processing") {
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [doc?.status, loadDocument]);

  async function handleSave() {
    if (!formData) return;
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extracted_data: formData }),
      });

      if (!res.ok) throw new Error("Chyba při ukládání.");
      setMessage("Změny uloženy.");
    } catch {
      setMessage("Nepodařilo se uložit změny.");
    }

    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("Opravdu chcete smazat tento doklad?")) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Chyba při mazání.");
      router.push("/dashboard");
    } catch {
      setMessage("Nepodařilo se smazat doklad.");
      setDeleting(false);
    }
  }

  async function handleRetryExtraction() {
    setDoc((prev) => (prev ? { ...prev, status: "processing" } : prev));
    try {
      await fetch(`/api/documents/${id}/extract`, { method: "POST" });
    } catch {
      setMessage("Nepodařilo se spustit extrakci.");
    }
  }

  async function handleSendToFakturoid() {
    setSendingToFakturoid(true);
    setMessage("");

    try {
      const res = await fetch(`/api/documents/${id}/fakturoid`, {
        method: "POST",
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Chyba při odesílání.");
      }

      const result = await res.json();
      setMessage(
        result.expense_url
          ? `Odesláno do Fakturoidu.`
          : "Odesláno do Fakturoidu."
      );
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Nepodařilo se odeslat do Fakturoidu."
      );
    }

    setSendingToFakturoid(false);
  }

  async function handleSendToIdoklad() {
    setSendingToIdoklad(true);
    setMessage("");

    try {
      const res = await fetch(`/api/documents/${id}/idoklad`, {
        method: "POST",
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Chyba při odesílání.");
      }

      const result = await res.json();
      setMessage(
        `Odesláno do iDokladu jako přijatá faktura #${result.invoiceNumber}`
      );
      // Reload to get updated sync info
      loadDocument();
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Nepodařilo se odeslat do iDokladu."
      );
    }

    setSendingToIdoklad(false);
  }

  async function handleAresLookup() {
    const supplierIco = formData?.supplier?.ico;
    if (!supplierIco) {
      setMessage("IČO dodavatele není vyplněno.");
      return;
    }
    setAresLoading(true);
    setAresResult(null);
    try {
      const res = await fetch(`/api/ares?ico=${encodeURIComponent(supplierIco)}`);
      if (res.ok) {
        const data = await res.json();
        setAresResult(data);
        setShowAresModal(true);
      } else {
        setMessage("IČO nenalezeno v ARES.");
      }
    } catch {
      setMessage("Nepodařilo se spojit s ARES.");
    }
    setAresLoading(false);
  }

  function applyAresData() {
    if (!aresResult || !formData) return;
    const updated = JSON.parse(JSON.stringify(formData));
    if (aresResult.name) updated.supplier.name = aresResult.name;
    if (aresResult.dic) updated.supplier.dic = aresResult.dic;
    if (aresResult.address) updated.supplier.address = aresResult.address;
    setFormData(updated);
    setShowAresModal(false);
    setMessage("Údaje dodavatele doplněny z ARES.");
  }

  function updateField(path: string, value: string | number | null) {
    if (!formData) return;
    const parts = path.split(".");
    const updated = JSON.parse(JSON.stringify(formData));
    let obj = updated;
    for (let i = 0; i < parts.length - 1; i++) {
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    setFormData(updated);
  }

  function updateItem(index: number, field: string, value: string | number | null) {
    if (!formData) return;
    const updated = { ...formData, items: [...formData.items] };
    updated.items[index] = { ...updated.items[index], [field]: value };
    setFormData(updated);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin inline-block w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full mb-3" />
          <p className="text-slate-500">Načítání dokladu...</p>
        </div>
      </div>
    );
  }

  if (!doc) return null;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 py-4">
          <Link href="/dashboard" className="text-xl font-bold text-slate-800">
            Doklady AI
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-slate-600 hover:text-slate-800"
          >
            ← Zpět na přehled
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Title + status */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {doc.file_name}
            </h2>
            <div className="mt-1">
              {doc.status === "processing" && (
                <span className="inline-flex items-center gap-1 text-sm text-yellow-700">
                  <span className="animate-spin inline-block w-3 h-3 border-2 border-yellow-300 border-t-yellow-600 rounded-full" />
                  Zpracovává se...
                </span>
              )}
              {doc.status === "done" && (
                <span className="text-sm text-green-700">Vytěženo</span>
              )}
              {doc.status === "error" && (
                <span className="text-sm text-red-700">
                  Chyba při extrakci{" "}
                  <button
                    onClick={handleRetryExtraction}
                    className="underline hover:no-underline"
                  >
                    — zkusit znovu
                  </button>
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {deleting ? "Mazání..." : "Smazat doklad"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* File preview */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="p-4 border-b border-slate-200 text-sm font-medium text-slate-700">
              Náhled dokladu
            </div>
            <div className="p-4 min-h-[500px] flex items-center justify-center bg-slate-50">
              {fileUrl ? (
                doc.file_type === "pdf" ? (
                  <iframe
                    src={fileUrl}
                    className="w-full h-[600px] border-0"
                    title="PDF Preview"
                  />
                ) : (
                  <img
                    src={fileUrl}
                    alt={doc.file_name}
                    className="max-w-full max-h-[600px] object-contain"
                  />
                )
              ) : (
                <p className="text-slate-400">Náhled není dostupný</p>
              )}
            </div>
          </div>

          {/* Extracted data form */}
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="p-4 border-b border-slate-200 text-sm font-medium text-slate-700">
              Vytěžená data
            </div>

            {doc.status === "processing" ? (
              <div className="p-8 text-center text-slate-500">
                <div className="animate-spin inline-block w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full mb-3" />
                <p>Probíhá extrakce dat...</p>
              </div>
            ) : !formData ? (
              <div className="p-8 text-center text-slate-500">
                <p>Žádná data k zobrazení.</p>
              </div>
            ) : (
              <div className="p-4 space-y-6 max-h-[650px] overflow-y-auto">
                {/* Document type */}
                <Field
                  label="Typ dokladu"
                  value={formData.document_type || ""}
                  onChange={(v) => updateField("document_type", v || null)}
                />

                {/* Supplier */}
                <fieldset className="border border-slate-200 rounded-lg p-3">
                  <legend className="text-xs font-semibold text-slate-500 px-1">
                    Dodavatel
                  </legend>
                  <div className="space-y-2">
                    <Field label="Název" value={formData.supplier?.name || ""} onChange={(v) => updateField("supplier.name", v || null)} />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-0.5">
                          IČO
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={formData.supplier?.ico || ""}
                            onChange={(e) => updateField("supplier.ico", e.target.value || null)}
                            className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
                          />
                          <button
                            onClick={handleAresLookup}
                            disabled={aresLoading}
                            className="rounded border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors shrink-0 flex items-center gap-1"
                            title="Ověřit v ARES"
                          >
                            {aresLoading ? (
                              <span className="animate-spin inline-block w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full" />
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                              </svg>
                            )}
                            ARES
                          </button>
                        </div>
                      </div>
                      <Field label="DIČ" value={formData.supplier?.dic || ""} onChange={(v) => updateField("supplier.dic", v || null)} />
                    </div>
                    <Field label="Adresa" value={formData.supplier?.address || ""} onChange={(v) => updateField("supplier.address", v || null)} />
                  </div>
                </fieldset>

                {/* Customer */}
                <fieldset className="border border-slate-200 rounded-lg p-3">
                  <legend className="text-xs font-semibold text-slate-500 px-1">
                    Odběratel
                  </legend>
                  <div className="space-y-2">
                    <Field label="Název" value={formData.customer?.name || ""} onChange={(v) => updateField("customer.name", v || null)} />
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="IČO" value={formData.customer?.ico || ""} onChange={(v) => updateField("customer.ico", v || null)} />
                      <Field label="DIČ" value={formData.customer?.dic || ""} onChange={(v) => updateField("customer.dic", v || null)} />
                    </div>
                    <Field label="Adresa" value={formData.customer?.address || ""} onChange={(v) => updateField("customer.address", v || null)} />
                  </div>
                </fieldset>

                {/* Invoice details */}
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Číslo dokladu" value={formData.invoice_number || ""} onChange={(v) => updateField("invoice_number", v || null)} />
                  <Field label="Variabilní symbol" value={formData.variable_symbol || ""} onChange={(v) => updateField("variable_symbol", v || null)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Datum vystavení" value={formData.issue_date || ""} onChange={(v) => updateField("issue_date", v || null)} type="date" />
                  <Field label="Datum splatnosti" value={formData.due_date || ""} onChange={(v) => updateField("due_date", v || null)} type="date" />
                </div>

                {/* Amounts */}
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Celková částka" value={formData.total_amount?.toString() || ""} onChange={(v) => updateField("total_amount", v ? parseFloat(v) : null)} type="number" />
                  <Field label="Měna" value={formData.currency || ""} onChange={(v) => updateField("currency", v || null)} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Základ DPH" value={formData.vat_base?.toString() || ""} onChange={(v) => updateField("vat_base", v ? parseFloat(v) : null)} type="number" />
                  <Field label="DPH" value={formData.vat_amount?.toString() || ""} onChange={(v) => updateField("vat_amount", v ? parseFloat(v) : null)} type="number" />
                  <Field label="Sazba %" value={formData.vat_rate?.toString() || ""} onChange={(v) => updateField("vat_rate", v ? parseFloat(v) : null)} type="number" />
                </div>

                <Field label="Číslo účtu" value={formData.bank_account || ""} onChange={(v) => updateField("bank_account", v || null)} />

                {/* Items */}
                {formData.items && formData.items.length > 0 && (
                  <fieldset className="border border-slate-200 rounded-lg p-3">
                    <legend className="text-xs font-semibold text-slate-500 px-1">
                      Položky
                    </legend>
                    <div className="space-y-3">
                      {formData.items.map((item, i) => (
                        <div key={i} className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                          <Field label={`Popis #${i + 1}`} value={item.description || ""} onChange={(v) => updateItem(i, "description", v || null)} />
                          <div className="grid grid-cols-3 gap-2 mt-1">
                            <Field label="Množství" value={item.quantity?.toString() || ""} onChange={(v) => updateItem(i, "quantity", v ? parseFloat(v) : null)} type="number" />
                            <Field label="Jedn. cena" value={item.unit_price?.toString() || ""} onChange={(v) => updateItem(i, "unit_price", v ? parseFloat(v) : null)} type="number" />
                            <Field label="Celkem" value={item.total?.toString() || ""} onChange={(v) => updateItem(i, "total", v ? parseFloat(v) : null)} type="number" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </fieldset>
                )}

                <Field label="Poznámky" value={formData.notes || ""} onChange={(v) => updateField("notes", v || null)} />

                {message && (
                  <p className={`text-sm ${message.includes("uložen") ? "text-green-700" : "text-red-700"}`}>
                    {message}
                  </p>
                )}

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Ukládání..." : "Uložit změny"}
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleSendToFakturoid}
                    disabled={sendingToFakturoid}
                    className="rounded-lg border border-emerald-600 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                  >
                    {sendingToFakturoid
                      ? "Odesílání..."
                      : "Odeslat do Fakturoidu"}
                  </button>
                  <button
                    onClick={handleSendToIdoklad}
                    disabled={sendingToIdoklad}
                    className="rounded-lg border border-blue-600 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                  >
                    {sendingToIdoklad
                      ? "Odesílání..."
                      : "Odeslat do iDokladu"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* ARES modal */}
        {showAresModal && aresResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-green-600 text-lg">&#10003;</span>
                <h3 className="text-lg font-semibold text-slate-900">
                  Nalezeno v ARES
                </h3>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-slate-500">Název:</span>{" "}
                  <span className="font-medium text-slate-900">{aresResult.name}</span>
                </div>
                <div>
                  <span className="text-slate-500">IČO:</span>{" "}
                  <span className="font-medium text-slate-900">{aresResult.ico}</span>
                </div>
                {aresResult.dic && (
                  <div>
                    <span className="text-slate-500">DIČ:</span>{" "}
                    <span className="font-medium text-slate-900">{aresResult.dic}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-500">Adresa:</span>{" "}
                  <span className="font-medium text-slate-900">{aresResult.address}</span>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={applyAresData}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
                >
                  Doplnit do dokladu
                </button>
                <button
                  onClick={() => setShowAresModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Zavřít
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-0.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
      />
    </div>
  );
}
