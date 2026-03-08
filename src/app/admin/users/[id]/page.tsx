"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface UserDetail {
  id: string;
  email: string;
  created_at: string;
  subscription_tier: string;
  is_admin: boolean;
  documents_total: number;
  documents_this_month: number;
  last_document_at: string | null;
  has_fakturoid: boolean;
  inbound_email_token: string;
}

interface RecentDoc {
  id: string;
  file_name: string;
  status: string;
  source: string;
  created_at: string;
  extraction_duration_ms: number | null;
  error_message: string | null;
}

interface UserDetailData {
  user: UserDetail;
  recent_documents: RecentDoc[];
  integrations: Array<{ provider: string; configured: boolean }>;
}

const STATUS_BADGE: Record<string, string> = {
  done: "bg-green-50 text-green-700",
  processing: "bg-yellow-50 text-yellow-700",
  error: "bg-red-50 text-red-700",
};

export default function AdminUserDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [data, setData] = useState<UserDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/users/${params.id}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  async function updateUser(updates: Record<string, unknown>) {
    setSaving(true);
    await fetch(`/api/admin/users/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const res = await fetch(`/api/admin/users/${params.id}`);
    setData(await res.json());
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-red-600">Uživatel nenalezen.</p>;
  }

  const { user, recent_documents, integrations } = data;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/users" className="text-slate-400 hover:text-slate-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">{user.email}</h1>
        {user.is_admin && (
          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
            Admin
          </span>
        )}
      </div>

      {/* User info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Info</h2>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-slate-500">Registrace</span>
            <span className="text-slate-900">{new Date(user.created_at).toLocaleDateString("cs-CZ")}</span>
            <span className="text-slate-500">Tarif</span>
            <span>
              <select
                value={user.subscription_tier}
                onChange={(e) => updateUser({ subscription_tier: e.target.value })}
                disabled={saving}
                className="rounded border border-slate-300 px-2 py-1 text-sm"
              >
                <option value="free">Free</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
              </select>
            </span>
            <span className="text-slate-500">Doklady celkem</span>
            <span className="text-slate-900">{user.documents_total}</span>
            <span className="text-slate-500">Doklady tento měsíc</span>
            <span className="text-slate-900">{user.documents_this_month}</span>
            <span className="text-slate-500">Poslední doklad</span>
            <span className="text-slate-900">
              {user.last_document_at ? new Date(user.last_document_at).toLocaleDateString("cs-CZ") : "-"}
            </span>
            <span className="text-slate-500">Inbound email</span>
            <span className="text-slate-900 font-mono text-xs">
              {user.inbound_email_token ? `${user.inbound_email_token}@doklady.fun` : "-"}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {/* Actions */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">Akce</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => updateUser({ is_admin: !user.is_admin })}
                disabled={saving}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {user.is_admin ? "Odebrat admin" : "Udělit admin"}
              </button>
            </div>
          </div>

          {/* Integrations */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2">
            <h2 className="text-sm font-semibold text-slate-700">Integrace</h2>
            {integrations.map((i) => (
              <div key={i.provider} className="flex justify-between text-sm">
                <span className="text-slate-600 capitalize">{i.provider}</span>
                <span className={i.configured ? "text-green-600" : "text-slate-400"}>
                  {i.configured ? "Nakonfigurováno" : "Nenakonfigurováno"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent documents */}
      <h2 className="text-lg font-semibold text-slate-900 mb-3">Poslední doklady</h2>
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-600">Soubor</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Zdroj</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Datum</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Extrakce</th>
            </tr>
          </thead>
          <tbody>
            {recent_documents.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-6 text-slate-400">
                  Žádné doklady
                </td>
              </tr>
            ) : (
              recent_documents.map((doc) => (
                <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-900 max-w-[200px] truncate">
                    {doc.file_name}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[doc.status] || "bg-slate-100 text-slate-600"}`}>
                      {doc.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{doc.source || "upload"}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(doc.created_at).toLocaleDateString("cs-CZ")}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">
                    {doc.extraction_duration_ms ? `${(doc.extraction_duration_ms / 1000).toFixed(1)}s` : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
