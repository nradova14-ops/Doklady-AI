"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface User {
  id: string;
  email: string;
  created_at: string;
  subscription_tier: string;
  is_admin: boolean;
  documents_total: number;
  documents_this_month: number;
  last_document_at: string | null;
  has_fakturoid: boolean;
}

const TIER_COLORS: Record<string, string> = {
  free: "bg-slate-100 text-slate-600",
  basic: "bg-blue-50 text-blue-700",
  pro: "bg-emerald-50 text-emerald-700",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const limit = 20;

  useEffect(() => {
    loadUsers();
  }, [page, search, tierFilter]);

  async function loadUsers() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    if (tierFilter) params.set("tier", tierFilter);

    try {
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch {
      console.error("Failed to load users");
    }
    setLoading(false);
  }

  async function handleTierChange(userId: string, newTier: string) {
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription_tier: newTier }),
    });
    loadUsers();
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Uživatelé</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            placeholder="Hledat email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-64"
          />
          <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700">
            Hledat
          </button>
        </form>
        <select
          value={tierFilter}
          onChange={(e) => { setTierFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Všechny tarify</option>
          <option value="free">Free</option>
          <option value="basic">Basic</option>
          <option value="pro">Pro</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Registrace</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Tarif</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Doklady</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Tento měsíc</th>
              <th className="text-center px-4 py-3 font-medium text-slate-600">Fakturoid</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Akce</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-400">
                  Načítám...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-400">
                  Žádní uživatelé
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${user.id}`} className="text-slate-900 hover:underline">
                      {user.email}
                    </Link>
                    {user.is_admin && (
                      <span className="ml-1.5 text-xs text-amber-600 font-medium">admin</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(user.created_at).toLocaleDateString("cs-CZ")}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.subscription_tier}
                      onChange={(e) => handleTierChange(user.id, e.target.value)}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium border-0 cursor-pointer ${TIER_COLORS[user.subscription_tier] || TIER_COLORS.free}`}
                    >
                      <option value="free">Free</option>
                      <option value="basic">Basic</option>
                      <option value="pro">Pro</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">{user.documents_total}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{user.documents_this_month}</td>
                  <td className="px-4 py-3 text-center">
                    {user.has_fakturoid ? (
                      <span className="text-green-600">Ano</span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="text-xs text-slate-500 hover:text-slate-800"
                    >
                      Detail
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4 text-sm">
          <span className="text-slate-500">
            Stránka {page} z {totalPages} ({total} celkem)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Předchozí
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Další
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
