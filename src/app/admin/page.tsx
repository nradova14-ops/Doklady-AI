"use client";

import { useEffect, useState } from "react";

interface Stats {
  total_users: number;
  new_users_this_week: number;
  new_users_this_month: number;
  total_documents: number;
  documents_this_month: number;
  error_documents: number;
  free_users: number;
  basic_users: number;
  pro_users: number;
  mrr_czk: number;
  fakturoid_users: number;
  documents_from_upload: number;
  documents_from_email: number;
  avg_extraction_ms: number;
}

function StatCard({ label, value, subtitle }: { label: string; value: string | number; subtitle?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full" />
      </div>
    );
  }

  if (!stats) {
    return <p className="text-red-600">Nepodařilo se načíst statistiky.</p>;
  }

  const totalDocs = stats.documents_from_upload + stats.documents_from_email;
  const uploadPct = totalDocs > 0 ? Math.round((stats.documents_from_upload / totalDocs) * 100) : 0;
  const emailPct = totalDocs > 0 ? 100 - uploadPct : 0;

  const totalTierUsers = stats.free_users + stats.basic_users + stats.pro_users;
  const freePct = totalTierUsers > 0 ? Math.round((stats.free_users / totalTierUsers) * 100) : 0;
  const basicPct = totalTierUsers > 0 ? Math.round((stats.basic_users / totalTierUsers) * 100) : 0;
  const proPct = totalTierUsers > 0 ? Math.round((stats.pro_users / totalTierUsers) * 100) : 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Přehled</h1>

      {/* Top stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Uživatelé"
          value={stats.total_users}
          subtitle={`+${stats.new_users_this_week} tento týden`}
        />
        <StatCard
          label="Doklady"
          value={stats.total_documents}
          subtitle={`+${stats.documents_this_month} tento měsíc`}
        />
        <StatCard
          label="MRR"
          value={`${stats.mrr_czk.toLocaleString("cs-CZ")} Kč`}
        />
        <StatCard
          label="Chyby"
          value={stats.error_documents}
        />
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tier breakdown */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Tarifní rozdělení</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">Free</span>
                <span className="text-slate-500">{stats.free_users} ({freePct}%)</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-slate-400 rounded-full" style={{ width: `${freePct}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">Basic</span>
                <span className="text-slate-500">{stats.basic_users} ({basicPct}%)</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${basicPct}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">Pro</span>
                <span className="text-slate-500">{stats.pro_users} ({proPct}%)</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${proPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Document sources */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Zdroje dokladů</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">Upload</span>
                <span className="text-slate-500">{stats.documents_from_upload} ({uploadPct}%)</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-slate-500 rounded-full" style={{ width: `${uploadPct}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">Email</span>
                <span className="text-slate-500">{stats.documents_from_email} ({emailPct}%)</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${emailPct}%` }} />
              </div>
            </div>
          </div>
          {stats.avg_extraction_ms > 0 && (
            <p className="mt-4 text-xs text-slate-400">
              Prům. doba extrakce: {(stats.avg_extraction_ms / 1000).toFixed(1)}s
            </p>
          )}
        </div>

        {/* Integrations */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Integrace</h3>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Fakturoid</span>
            <span className="text-sm font-medium text-slate-900">{stats.fakturoid_users} uživatelů</span>
          </div>
        </div>
      </div>
    </div>
  );
}
