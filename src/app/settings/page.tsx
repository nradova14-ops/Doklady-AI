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

  // Inbound email state
  const [inboundEmail, setInboundEmail] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Company profile state
  const [companyName, setCompanyName] = useState("");
  const [ico, setIco] = useState("");
  const [dic, setDic] = useState("");
  const [isVatPayer, setIsVatPayer] = useState(false);
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyCity, setCompanyCity] = useState("");
  const [companyZip, setCompanyZip] = useState("");
  const [savingCompany, setSavingCompany] = useState(false);
  const [loadingAres, setLoadingAres] = useState(false);

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

  // iDoklad form state
  const [idClientId, setIdClientId] = useState("");
  const [idClientSecret, setIdClientSecret] = useState("");
  const [idShowSecret, setIdShowSecret] = useState(false);
  const [idIsConfigured, setIdIsConfigured] = useState(false);
  const [idSaving, setIdSaving] = useState(false);
  const [idTesting, setIdTesting] = useState(false);
  const [idDeleting, setIdDeleting] = useState(false);
  const [idTestResult, setIdTestResult] = useState<{
    success: boolean;
    error?: string;
    companyName?: string;
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

    // Load inbound email profile + company data
    const profileRes = await fetch("/api/settings/profile");
    if (profileRes.ok) {
      const profileData = await profileRes.json();
      setInboundEmail(profileData.inbound_email || "");
      setCompanyName(profileData.company_name || "");
      setIco(profileData.ico || "");
      setDic(profileData.dic || "");
      setIsVatPayer(profileData.is_vat_payer || false);
      setCompanyAddress(profileData.address || "");
      setCompanyCity(profileData.city || "");
      setCompanyZip(profileData.zip || "");
    }

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
      const idoklad = integrations?.find(
        (i: { provider: string }) => i.provider === "idoklad"
      );
      if (idoklad) {
        setIdClientId(idoklad.client_id || "");
        setIdClientSecret("");
        setIdIsConfigured(true);
      }
    }

    setLoading(false);
  }

  async function handleCopyEmail() {
    try {
      await navigator.clipboard.writeText(inboundEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setToast({ message: "Nepodařilo se zkopírovat.", type: "error" });
    }
  }

  async function handleRegenerateToken() {
    if (!confirm("Opravdu chcete vygenerovat novou adresu? Stará přestane fungovat.")) return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate_token" }),
      });
      if (res.ok) {
        const data = await res.json();
        setInboundEmail(data.inbound_email);
        setToast({ message: "Nová adresa vygenerována.", type: "success" });
      } else {
        setToast({ message: "Nepodařilo se vygenerovat novou adresu.", type: "error" });
      }
    } catch {
      setToast({ message: "Chyba při generování.", type: "error" });
    }
    setRegenerating(false);
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

  async function handleIdokladSave() {
    if (!idClientId || (!idClientSecret && !idIsConfigured)) {
      setToast({ message: "Vyplňte Client ID a Client Secret.", type: "error" });
      return;
    }
    if (idIsConfigured && !idClientSecret) {
      setToast({ message: "Zadejte Client Secret pro aktualizaci.", type: "error" });
      return;
    }

    setIdSaving(true);
    try {
      const res = await fetch("/api/settings/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "idoklad",
          slug: "idoklad",
          client_id: idClientId,
          client_secret: idClientSecret,
        }),
      });

      if (res.ok) {
        setToast({ message: "iDoklad integrace uložena.", type: "success" });
        setIdIsConfigured(true);
        setIdClientSecret("");
        setIdShowSecret(false);
        setIdTestResult(null);
      } else {
        const data = await res.json();
        setToast({ message: data.error || "Nepodařilo se uložit.", type: "error" });
      }
    } catch {
      setToast({ message: "Chyba při ukládání.", type: "error" });
    }
    setIdSaving(false);
  }

  async function handleIdokladTest() {
    setIdTesting(true);
    setIdTestResult(null);
    try {
      const res = await fetch("/api/settings/integrations/idoklad-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "idoklad" }),
      });
      const data = await res.json();
      setIdTestResult(data);
    } catch {
      setIdTestResult({ success: false, error: "Chyba při testování." });
    }
    setIdTesting(false);
  }

  async function handleIdokladDelete() {
    if (!confirm("Opravdu chcete smazat iDoklad integraci?")) return;
    setIdDeleting(true);
    try {
      const res = await fetch(
        "/api/settings/integrations?provider=idoklad",
        { method: "DELETE" }
      );
      if (res.ok) {
        setIdClientId("");
        setIdClientSecret("");
        setIdIsConfigured(false);
        setIdTestResult(null);
        setToast({ message: "iDoklad integrace smazána.", type: "success" });
      }
    } catch {
      setToast({ message: "Chyba při mazání.", type: "error" });
    }
    setIdDeleting(false);
  }

  async function handleAresLookup() {
    if (!ico.trim()) {
      setToast({ message: "Zadejte IČO.", type: "error" });
      return;
    }
    setLoadingAres(true);
    try {
      const res = await fetch(`/api/ares?ico=${encodeURIComponent(ico.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setCompanyName(data.name || "");
        if (data.dic) setDic(data.dic);
        setCompanyAddress(data.address || "");
        setCompanyCity(data.city || "");
        setCompanyZip(data.zip || "");
        setIco(data.ico || ico);
        if (data.dic) setIsVatPayer(true);
        setToast({ message: "Údaje načteny z ARES.", type: "success" });
      } else {
        setToast({ message: "IČO nenalezeno v ARES.", type: "error" });
      }
    } catch {
      setToast({ message: "Nepodařilo se spojit s ARES.", type: "error" });
    }
    setLoadingAres(false);
  }

  async function handleSaveCompany() {
    setSavingCompany(true);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName,
          ico,
          dic,
          address: companyAddress,
          city: companyCity,
          zip: companyZip,
          is_vat_payer: isVatPayer,
        }),
      });
      if (res.ok) {
        setToast({ message: "Profil firmy uložen.", type: "success" });
      } else {
        setToast({ message: "Nepodařilo se uložit profil.", type: "error" });
      }
    } catch {
      setToast({ message: "Chyba při ukládání.", type: "error" });
    }
    setSavingCompany(false);
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
          <div className="space-y-6">
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

            {/* Email inbound section */}
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-2 mb-1">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-slate-600">
                  <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
                  <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
                </svg>
                <h2 className="text-lg font-semibold text-slate-900">
                  Email příjem
                </h2>
              </div>
              <p className="text-sm text-slate-500 mb-4">
                Pošlete fakturu na tuto adresu a automaticky se zpracuje.
              </p>

              <div className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Vaše adresa
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={inboundEmail}
                      readOnly
                      className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 font-mono cursor-default select-all"
                    />
                    <button
                      onClick={handleCopyEmail}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors shrink-0"
                      title="Zkopírovat do schránky"
                    >
                      {copied ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-green-600">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
                          <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
                  <p className="font-medium text-slate-700 mb-2">Jak to funguje:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Nastavte přeposílání faktur ve svém emailu na adresu výše</li>
                    <li>Nebo přímo pošlete fakturu jako přílohu na tuto adresu</li>
                    <li>PDF a obrázky v příloze se automaticky vytěží</li>
                  </ol>
                </div>

                <button
                  onClick={handleRegenerateToken}
                  disabled={regenerating}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  {regenerating ? "Generuji..." : "Vygenerovat novou adresu"}
                </button>
                <p className="text-xs text-slate-400">
                  Vygenerováním nové adresy stará přestane fungovat.
                </p>
              </div>
            </div>

            {/* Company profile section */}
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-2 mb-1">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-slate-600">
                  <path fillRule="evenodd" d="M4 16.5v-13h-.25a.75.75 0 010-1.5h12.5a.75.75 0 010 1.5H16v13h.25a.75.75 0 010 1.5h-3.5a.75.75 0 01-.75-.75v-2.5a.75.75 0 00-.75-.75h-2.5a.75.75 0 00-.75.75v2.5a.75.75 0 01-.75.75h-3.5a.75.75 0 010-1.5H4zm3-11a.5.5 0 01.5-.5h1a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5v-1zm.5 3.5a.5.5 0 00-.5.5v1a.5.5 0 00.5.5h1a.5.5 0 00.5-.5v-1a.5.5 0 00-.5-.5h-1zm3.5-3.5a.5.5 0 01.5-.5h1a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5v-1zm.5 3.5a.5.5 0 00-.5.5v1a.5.5 0 00.5.5h1a.5.5 0 00.5-.5v-1a.5.5 0 00-.5-.5h-1z" clipRule="evenodd" />
                </svg>
                <h2 className="text-lg font-semibold text-slate-900">
                  Profil firmy
                </h2>
              </div>
              <p className="text-sm text-slate-500 mb-4">
                Údaje o vaší firmě pro automatické vyplňování dokladů.
              </p>

              <div className="space-y-4 max-w-lg">
                {/* IČO + ARES button */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    IČO
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={ico}
                      onChange={(e) => setIco(e.target.value)}
                      placeholder="12345678"
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                    />
                    <button
                      onClick={handleAresLookup}
                      disabled={loadingAres}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shrink-0 flex items-center gap-1.5"
                    >
                      {loadingAres ? (
                        <>
                          <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full" />
                          Načítám...
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                          </svg>
                          Načíst z ARES
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Název firmy
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Název firmy nebo jméno OSVČ"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">
                      DIČ
                    </label>
                    <input
                      type="text"
                      value={dic}
                      onChange={(e) => setDic(e.target.value)}
                      placeholder="CZ12345678"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isVatPayer}
                        onClick={() => setIsVatPayer(!isVatPayer)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          isVatPayer ? "bg-slate-800" : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            isVatPayer ? "translate-x-5" : ""
                          }`}
                        />
                      </button>
                      <span className="text-sm text-slate-600">Plátce DPH</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Ulice a číslo
                  </label>
                  <input
                    type="text"
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    placeholder="Nové sady 988/2"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">
                      Město
                    </label>
                    <input
                      type="text"
                      value={companyCity}
                      onChange={(e) => setCompanyCity(e.target.value)}
                      placeholder="Brno"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">
                      PSČ
                    </label>
                    <input
                      type="text"
                      value={companyZip}
                      onChange={(e) => setCompanyZip(e.target.value)}
                      placeholder="602 00"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleSaveCompany}
                    disabled={savingCompany}
                    className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
                  >
                    {savingCompany ? "Ukládám..." : "Uložit změny"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Integrations Tab */}
        {activeTab === "integrations" && (
          <div className="space-y-6">
          {/* Money S3 card */}
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2 mb-1">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-slate-600">
                <path fillRule="evenodd" d="M1 2.75A.75.75 0 011.75 2h16.5a.75.75 0 010 1.5H18v8.75A2.75 2.75 0 0115.25 15h-1.072l.798 3.06a.75.75 0 01-1.452.38L13.41 18H6.59l-.114.44a.75.75 0 01-1.452-.38L5.822 15H4.75A2.75 2.75 0 012 12.25V3.5h-.25A.75.75 0 011 2.75zM7.373 15l-.391 1.5h6.037l-.391-1.5H7.372zm.529-3h4.196a.75.75 0 000-1.5H7.902a.75.75 0 000 1.5zM6.902 9h6.196a.75.75 0 000-1.5H6.902a.75.75 0 000 1.5z" clipRule="evenodd" />
              </svg>
              <h2 className="text-lg font-semibold text-slate-900">
                Money S3
              </h2>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Export dokladů ve formátu XML kompatibilním s Money S3.
            </p>
            <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800 ring-1 ring-green-200 mb-4">
              Nevyžaduje konfiguraci — stačí exportovat XML z přehledu dokladů a importovat do Money S3 přes Soubor → Import.
            </div>
            <a
              href="https://www.money.cz/money-s3/podpora"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
            >
              Jak importovat? →
            </a>
          </div>

          {/* Fakturoid card */}
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

          {/* iDoklad card */}
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-slate-600">
                  <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-3.69l-5.027 2.514a3.25 3.25 0 01-2.946 0L1.5 11.06zm0-1.248l5.527 2.764a1.75 1.75 0 001.586 0L15.14 9.812l.001-.001L16.5 9.11V5.25a.75.75 0 00-.75-.75H3.25a.75.75 0 00-.75.75v4.812l-.001.001-.999.5v-.001z" clipRule="evenodd" />
                </svg>
                <h2 className="text-lg font-semibold text-slate-900">
                  iDoklad
                </h2>
              </div>
              {idIsConfigured && (
                <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                  Nakonfigurováno
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mb-5">
              Propojte svůj iDoklad účet pro odesílání přijatých faktur.
            </p>

            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Client ID
                </label>
                <input
                  type="text"
                  value={idClientId}
                  onChange={(e) => setIdClientId(e.target.value)}
                  placeholder="Váš iDoklad Client ID"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Client Secret
                </label>
                <div className="relative">
                  <input
                    type={idShowSecret ? "text" : "password"}
                    value={idClientSecret}
                    onChange={(e) => setIdClientSecret(e.target.value)}
                    placeholder={
                      idIsConfigured ? "••••••••••••••••" : "Váš client secret"
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setIdShowSecret(!idShowSecret)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    title={idShowSecret ? "Skrýt" : "Zobrazit"}
                  >
                    {idShowSecret ? (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.092 1.092a4 4 0 00-5.558-5.558z" clipRule="evenodd" />
                        <path d="M10.748 13.93l2.523 2.523a9.987 9.987 0 01-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 012.839 6.02L6.07 9.252a4 4 0 004.678 4.678z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                        <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                </div>
                {idIsConfigured && (
                  <p className="text-xs text-slate-400 mt-1">
                    Ponechte prázdné pokud nechcete měnit.
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleIdokladSave}
                  disabled={idSaving}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  {idSaving ? "Ukládám..." : "Uložit"}
                </button>
                {idIsConfigured && (
                  <>
                    <button
                      onClick={handleIdokladTest}
                      disabled={idTesting}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      {idTesting ? "Testuji..." : "Otestovat připojení"}
                    </button>
                    <button
                      onClick={handleIdokladDelete}
                      disabled={idDeleting}
                      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      Smazat
                    </button>
                  </>
                )}
              </div>

              {/* Test result */}
              {idTestResult && (
                <div
                  className={`rounded-lg px-4 py-3 text-sm ${
                    idTestResult.success
                      ? "bg-green-50 text-green-800 ring-1 ring-green-200"
                      : "bg-red-50 text-red-800 ring-1 ring-red-200"
                  }`}
                >
                  {idTestResult.success
                    ? `Připojení k iDoklad je funkční.${idTestResult.companyName ? ` Firma: ${idTestResult.companyName}` : ""}`
                    : `Chyba: ${idTestResult.error}`}
                </div>
              )}
            </div>
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
