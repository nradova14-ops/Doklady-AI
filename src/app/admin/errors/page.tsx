"use client";

import { useEffect, useState } from "react";

interface ErrorDoc {
  id: string;
  user_email: string;
  file_name: string;
  error_message: string | null;
  created_at: string;
  source: string;
}

export default function AdminErrorsPage() {
  const [errors, setErrors] = useState<ErrorDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/errors")
      .then((r) => r.json())
      .then((data) => setErrors(data.errors || []))
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

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Chybové doklady</h1>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-600">Uživatel</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Soubor</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Chyba</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Zdroj</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Datum</th>
            </tr>
          </thead>
          <tbody>
            {errors.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-400">
                  Žádné chyby
                </td>
              </tr>
            ) : (
              errors.map((err) => (
                <tr key={err.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{err.user_email}</td>
                  <td className="px-4 py-3 text-slate-900 max-w-[200px] truncate">{err.file_name}</td>
                  <td className="px-4 py-3 text-red-600 max-w-[300px] truncate">
                    {err.error_message || "Neznámá chyba"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{err.source}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(err.created_at).toLocaleString("cs-CZ")}
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
