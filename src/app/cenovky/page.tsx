"use client";

import { useState, useRef } from "react";

interface PriceTag {
  id: string;
  nazev: string;
  stupen: string;
  typ: string;
  objem: string;
  cenaZaLitr: string;
  cenaZbozi: string;
}

const emptyTag: Omit<PriceTag, "id"> = {
  nazev: "",
  stupen: "",
  typ: "",
  objem: "",
  cenaZaLitr: "",
  cenaZbozi: "",
};

export default function CenovkyPage() {
  const [tags, setTags] = useState<PriceTag[]>([]);
  const [form, setForm] = useState(emptyTag);
  const [editingId, setEditingId] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAdd = () => {
    if (!form.nazev || !form.cenaZbozi) return;
    if (editingId) {
      setTags(tags.map((t) => (t.id === editingId ? { ...form, id: editingId } : t)));
      setEditingId(null);
    } else {
      setTags([...tags, { ...form, id: crypto.randomUUID() }]);
    }
    setForm(emptyTag);
  };

  const handleEdit = (tag: PriceTag) => {
    setForm({ nazev: tag.nazev, stupen: tag.stupen, typ: tag.typ, objem: tag.objem, cenaZaLitr: tag.cenaZaLitr, cenaZbozi: tag.cenaZbozi });
    setEditingId(tag.id);
  };

  const handleDelete = (id: string) => {
    setTags(tags.filter((t) => t.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setForm(emptyTag);
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cenovky - Tisk</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; }
          .grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            padding: 12px;
          }
          .tag {
            border: 2px solid #1a1a2e;
            border-radius: 10px;
            padding: 14px;
            page-break-inside: avoid;
            background: #fff;
          }
          .tag-name {
            font-size: 20px;
            font-weight: 800;
            color: #1a1a2e;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 2px;
          }
          .tag-type {
            font-size: 13px;
            color: #666;
            margin-bottom: 8px;
          }
          .tag-degree {
            display: inline-block;
            background: #f97316;
            color: #fff;
            font-weight: 700;
            font-size: 14px;
            padding: 2px 10px;
            border-radius: 999px;
            margin-bottom: 8px;
          }
          .tag-details {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: #555;
            border-top: 1px solid #e5e5e5;
            padding-top: 6px;
            margin-bottom: 8px;
          }
          .tag-price {
            font-size: 28px;
            font-weight: 900;
            color: #1a1a2e;
            text-align: right;
          }
          .tag-price span {
            font-size: 14px;
            font-weight: 400;
            color: #666;
          }
          @media print {
            .grid { padding: 0; gap: 8px; }
          }
        </style>
      </head>
      <body>
        ${printRef.current.innerHTML}
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Cenovky</h1>
            <p className="text-primary-300 text-sm mt-1">Vytvářejte cenové štítky na pivo</p>
          </div>
          <a href="/dashboard" className="text-sm text-primary-300 hover:text-white transition-colors">
            &larr; Zpět na dashboard
          </a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-primary-900 mb-4">
            {editingId ? "Upravit cenovku" : "Nová cenovka"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Název piva</label>
              <input
                name="nazev"
                value={form.nazev}
                onChange={handleChange}
                placeholder="např. Jantar"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent-400 focus:border-accent-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stupeň</label>
              <input
                name="stupen"
                value={form.stupen}
                onChange={handleChange}
                placeholder="např. 11°"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent-400 focus:border-accent-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Typ</label>
              <input
                name="typ"
                value={form.typ}
                onChange={handleChange}
                placeholder="např. světlý ležák"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent-400 focus:border-accent-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Objem (ml)</label>
              <input
                name="objem"
                value={form.objem}
                onChange={handleChange}
                placeholder="např. 500"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent-400 focus:border-accent-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cena za 1 l (Kč)</label>
              <input
                name="cenaZaLitr"
                value={form.cenaZaLitr}
                onChange={handleChange}
                placeholder="např. 59,80"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent-400 focus:border-accent-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cena zboží (Kč)</label>
              <input
                name="cenaZbozi"
                value={form.cenaZbozi}
                onChange={handleChange}
                placeholder="např. 29,90"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent-400 focus:border-accent-400 outline-none"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleAdd}
              disabled={!form.nazev || !form.cenaZbozi}
              className="bg-accent-500 hover:bg-accent-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors"
            >
              {editingId ? "Uložit změny" : "Přidat cenovku"}
            </button>
            {editingId && (
              <button
                onClick={() => { setEditingId(null); setForm(emptyTag); }}
                className="text-gray-500 hover:text-gray-700 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Zrušit
              </button>
            )}
          </div>
        </div>

        {/* Tags list */}
        {tags.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-primary-900">
                Vytvořené cenovky ({tags.length})
              </h2>
              <button
                onClick={handlePrint}
                className="bg-primary-900 hover:bg-primary-800 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Tisknout cenovky
              </button>
            </div>

            {/* Editable table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Název</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Stupeň</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Typ</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Objem</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Cena/l</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Cena</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {tags.map((tag) => (
                    <tr key={tag.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-primary-900">{tag.nazev}</td>
                      <td className="px-4 py-3">
                        {tag.stupen && (
                          <span className="bg-accent-100 text-accent-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                            {tag.stupen}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{tag.typ}</td>
                      <td className="px-4 py-3 text-gray-600">{tag.objem ? `${tag.objem} ml` : ""}</td>
                      <td className="px-4 py-3 text-gray-600">{tag.cenaZaLitr ? `${tag.cenaZaLitr} Kč` : ""}</td>
                      <td className="px-4 py-3 font-bold text-primary-900">{tag.cenaZbozi} Kč</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleEdit(tag)}
                          className="text-accent-500 hover:text-accent-700 font-medium mr-3 transition-colors"
                        >
                          Upravit
                        </button>
                        <button
                          onClick={() => handleDelete(tag.id)}
                          className="text-red-400 hover:text-red-600 font-medium transition-colors"
                        >
                          Smazat
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Print preview */}
            <h2 className="text-lg font-semibold text-primary-900 mb-4">Náhled tisku</h2>
            <div ref={printRef} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {tags.map((tag) => (
                  <div key={tag.id} className="border-2 border-primary-900 rounded-xl p-4">
                    <div className="text-xl font-extrabold text-primary-900 uppercase tracking-wide">
                      {tag.nazev}
                    </div>
                    {tag.typ && (
                      <div className="text-xs text-gray-500 mb-2">{tag.typ}</div>
                    )}
                    {tag.stupen && (
                      <span className="inline-block bg-accent-500 text-white text-sm font-bold px-3 py-0.5 rounded-full mb-2">
                        {tag.stupen}
                      </span>
                    )}
                    <div className="flex justify-between text-xs text-gray-500 border-t border-gray-200 pt-2 mb-2">
                      {tag.objem && <span>{tag.objem} ml</span>}
                      {tag.cenaZaLitr && <span>Cena za 1 l: {tag.cenaZaLitr} Kč</span>}
                    </div>
                    <div className="text-right">
                      <span className="text-3xl font-black text-primary-900">{tag.cenaZbozi}</span>
                      <span className="text-sm text-gray-500 ml-1">Kč</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {tags.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <p className="text-lg font-medium">Zatím žádné cenovky</p>
            <p className="text-sm mt-1">Vyplňte formulář výše a přidejte první cenovku</p>
          </div>
        )}
      </div>
    </div>
  );
}
