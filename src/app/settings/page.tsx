"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Tab = "profile" | "integrations" | "subscription";

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("integrations");
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(true);

  // Fakturoid form state
  const [slug, setSlug] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  async function loadData() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    setUserEmail(user.email || "");

    // Load integrations
    const res = await fetch("/api/settings/integrations");
    if (res.ok) {
      const { integrations } = await res.json();
      const fakturoid = integrations?.find(
        (i: { provider: string }) => i.provider === "fakturoid"
      );
      if (fakturoid) {
        setSlug(fakturoid.slug || "");
        setClientId(fakturoid.client_id || "");
        setClientSecret("");
        setIsConfigured(true);
      }
    }

    setLoading(false);
  }

  async function handleSave() {
    if (!slug || !clientId || (!clientSecret && !isConfigured)) {
      setToast({ message: "Vyplňte všechna pole.", type: "error" });
      return;
    }

    // If already configured and secret is empty, user didn't change it — need to inform
    if (isConfigured && !clientSecret) {
      setToast({
        message: "Zadejte Client Secret pro aktualizaci.",
        type: "error",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/settings/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "fakturoid",
          slug,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (res.ok) {
        setToast({ message: "Integrace uložena.", type: "success" });
        setIsConfigured(true);
        setClientSecret("");
        setShowSecret(false);
        setTestResult(null);
      } else {
        const data = await res.json();
        setToast({
          message: data.error || "Nepodařilo se uložit.",
          type: "error",
        });
      }
    } catch {
      setToast({ message: "Chyba při ukládání.", type: "error" });
    }
    setSaving(false);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "fakturoid" }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, error: "Chyba při testování." });
    }
    setTesting(false);
  }

  async function handleDelete() {
    if (!confirm("Opravdu chcete smazat Fakturoid integraci?")) return;
    setDeleting(true);
    try {
      const res = await fetch(
        "/api/settings/integrations?provider=fakturoid",
        { method: "DELETE" }
      );
      if (res.ok) {
        setSlug("");
        setClientId("");
        setClientSecret("");
        setIsConfigured(false);
        setTestResult(null);
        setToast({ message: "Integrace smazána.", type: "success" });
      }
    } catch {
      setToast({ message: "Chyba při mazání.", type: "error" });
    }
    setDeleting(false);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "profile", label: "Profil" },
    { key: "integrations", label: "Integrace" },
    { key: "subscription", label: "Předplatné" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-4xl flex items-center justify-between px-4 py-4">
            <Link
              href="/dashboard"
              className="text-xl font-bold text-slate-800"
            >
              Doklady AI
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-8">
          <div className="text-center py-12 text-slate-500">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full mb-3" />
            <p>Načítání...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl flex items-center justify-between px-4 py-4">
          <Link
            href="/dashboard"
            className="text-xl font-bold text-slate-800"
          >
            Doklady AI
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-slate-600 hover:text-slate-800"
            >
              ← Zpět na přehled
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

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all ${
            toast.type === "success"
              ? "bg-green-50 text-green-800 ring-1 ring-green-200"
              : "bg-red-50 text-red-800 ring-1 ring-red-200"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-slate-900 mb-6">
          Nastavení
        </h1>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                activeTab === tab.key
                  ? "text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800 rounded-t" />
              )}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Profil
            </h2>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  value={userEmail}
                  readOnly
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        )}

        {/* Integrations Tab */}
        {activeTab === "integrations" && (
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-slate-900">
                Fakturoid
              </h2>
              {isConfigured && (
                <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                  Nakonfigurováno
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mb-5">
              Propojte svůj Fakturoid účet pro automatické odesílání dokladů.
            </p>

            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Slug účtu
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="nazev-firmy"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Z URL: app.fakturoid.cz/
                  <span className="font-medium">slug</span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Client ID
                </label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Client Secret
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? "text" : "password"}
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder={
                      isConfigured ? "••••••••••••••••" : "Váš client secret"
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    title={showSecret ? "Skrýt" : "Zobrazit"}
                  >
                    {showSecret ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-4 h-4"
                      >
                        <path
                          fillRule="evenodd"
                          d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.092 1.092a4 4 0 00-5.558-5.558z"
                          clipRule="evenodd"
                        />
                        <path d="M10.748 13.93l2.523 2.523a9.987 9.987 0 01-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 012.839 6.02L6.07 9.252a4 4 0 004.678 4.678z" />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-4 h-4"
                      >
                        <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                        <path
                          fillRule="evenodd"
                          d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                </div>
                {isConfigured && (
                  <p className="text-xs text-slate-400 mt-1">
                    Ponechte prázdné pokud nechcete měnit.
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Ukládám..." : "Uložit"}
                </button>
                {isConfigured && (
                  <>
                    <button
                      onClick={handleTest}
                      disabled={testing}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      {testing ? "Testuji..." : "Otestovat připojení"}
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      Smazat
                    </button>
                  </>
                )}
              </div>

              {/* Test result */}
              {testResult && (
                <div
                  className={`rounded-lg px-4 py-3 text-sm ${
                    testResult.success
                      ? "bg-green-50 text-green-800 ring-1 ring-green-200"
                      : "bg-red-50 text-red-800 ring-1 ring-red-200"
                  }`}
                >
                  {testResult.success
                    ? "Připojení k Fakturoid je funkční."
                    : `Chyba: ${testResult.error}`}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Subscription Tab */}
        {activeTab === "subscription" && (
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Předplatné
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-600">Aktuální plán</span>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  Free
                </span>
              </div>
              <div className="border-t border-slate-100" />
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-600">
                  Doklady tento měsíc
                </span>
                <span className="text-sm font-medium text-slate-900">—</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
