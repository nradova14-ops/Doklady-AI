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

const beerTypes = [
  { label: "Světlý ležák", category: "lezak" },
  { label: "Tmavý ležák", category: "lezak" },
  { label: "Polotmavý ležák", category: "lezak" },
  { label: "IPA", category: "svrchni" },
  { label: "APA", category: "svrchni" },
  { label: "Pale Ale", category: "svrchni" },
  { label: "Wheat / Pšeničné", category: "svrchni" },
  { label: "Sour / Kyseláč", category: "kyselac" },
  { label: "Gose", category: "kyselac" },
  { label: "Stout", category: "stout" },
  { label: "Porter", category: "stout" },
] as const;

type Category = (typeof beerTypes)[number]["category"];

const categoryColors: Record<Category, { text: string; bg: string; border: string; print: string }> = {
  lezak:   { text: "text-blue-700",   bg: "bg-blue-50",    border: "border-blue-300", print: "#1d4ed8" },
  svrchni: { text: "text-green-700",  bg: "bg-green-50",   border: "border-green-300", print: "#15803d" },
  kyselac: { text: "text-orange-600", bg: "bg-orange-50",  border: "border-orange-300", print: "#ea580c" },
  stout:   { text: "text-purple-700", bg: "bg-purple-50",  border: "border-purple-300", print: "#7e22ce" },
};

function getCategoryForType(typ: string): Category {
  const found = beerTypes.find((bt) => bt.label === typ);
  return found?.category ?? "lezak";
}

function getColors(typ: string) {
  return categoryColors[getCategoryForType(typ)];
}

const emptyTag: Omit<PriceTag, "id"> = {
  nazev: "",
  stupen: "",
  typ: beerTypes[0].label,
  objem: "",
  cenaZaLitr: "",
  cenaZbozi: "",
};

export default function CenovkyPage() {
  const [tags, setTags] = useState<PriceTag[]>([]);
  const [form, setForm] = useState(emptyTag);
  const [editingId, setEditingId] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
    setForm({
      nazev: tag.nazev,
      stupen: tag.stupen,
      typ: tag.typ,
      objem: tag.objem,
      cenaZaLitr: tag.cenaZaLitr,
      cenaZbozi: tag.cenaZbozi,
    });
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

    const tagsHtml = tags
      .map((tag) => {
        const color = getColors(tag.typ).print;
        return `
        <div class="tag" style="border-color: ${color};">
          <div class="tag-name">${tag.nazev}</div>
          <div class="tag-type" style="color: ${color}; font-weight: 700;">${tag.typ}</div>
          ${tag.stupen ? `<div class="tag-degree" style="background: ${color};">${tag.stupen}</div>` : ""}
          <div class="tag-details">
            ${tag.objem ? `<span>${tag.objem} ml</span>` : "<span></span>"}
            ${tag.cenaZaLitr ? `<span>${tag.cenaZaLitr} Kč/l</span>` : "<span></span>"}
          </div>
          <div class="tag-price">${tag.cenaZbozi} <span>Kč</span></div>
        </div>`;
      })
      .join("");

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Cenovky - Tisk</title>
  <style>
    @page {
      size: A4;
      margin: 10mm;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; }
    .grid {
      display: grid;
      grid-template-columns: repeat(6, 30mm);
      grid-auto-rows: 30mm;
      gap: 3mm;
      justify-content: center;
    }
    .tag {
      width: 30mm;
      height: 30mm;
      border: 1.5pt solid #1a1a2e;
      border-radius: 2mm;
      padding: 2mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .tag-name {
      font-size: 8pt;
      font-weight: 800;
      color: #1a1a2e;
      text-transform: uppercase;
      line-height: 1.1;
    }
    .tag-type {
      font-size: 5.5pt;
      line-height: 1.2;
    }
    .tag-degree {
      display: inline-block;
      color: #fff;
      font-weight: 700;
      font-size: 6pt;
      padding: 0.5mm 2mm;
      border-radius: 999px;
      align-self: flex-start;
    }
    .tag-details {
      display: flex;
      justify-content: space-between;
      font-size: 5pt;
      color: #555;
      border-top: 0.5pt solid #ddd;
      padding-top: 1mm;
    }
    .tag-price {
      font-size: 14pt;
      font-weight: 900;
      color: #1a1a2e;
      text-align: right;
      line-height: 1;
    }
    .tag-price span {
      font-size: 7pt;
      font-weight: 400;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="grid">${tagsHtml}</div>
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <h1 className="text-2xl font-bold">Cenovky na pivo</h1>
          <p className="text-primary-300 text-sm mt-1">Vytvořte a vytiskněte cenové štítky 3&times;3 cm</p>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Druh piva</label>
              <select
                name="typ"
                value={form.typ}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent-400 focus:border-accent-400 outline-none bg-white"
              >
                {beerTypes.map((bt) => (
                  <option key={bt.label} value={bt.label}>
                    {bt.label}
                  </option>
                ))}
              </select>
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
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyTag);
                }}
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

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Název</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Stupeň</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Druh</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Objem</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Cena/l</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Cena</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {tags.map((tag) => {
                    const colors = getColors(tag.typ);
                    return (
                      <tr key={tag.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-primary-900">{tag.nazev}</td>
                        <td className="px-4 py-3">
                          {tag.stupen && (
                            <span className="bg-gray-100 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                              {tag.stupen}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                            {tag.typ}
                          </span>
                        </td>
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
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Print preview */}
            <h2 className="text-lg font-semibold text-primary-900 mb-4">Náhled cenovek (3&times;3 cm)</h2>
            <div ref={printRef} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex flex-wrap gap-3">
                {tags.map((tag) => {
                  const colors = getColors(tag.typ);
                  return (
                    <div
                      key={tag.id}
                      className={`border-2 ${colors.border} rounded-lg p-2 flex flex-col justify-between`}
                      style={{ width: "113px", height: "113px" }}
                    >
                      <div>
                        <div className="text-[9px] font-extrabold text-primary-900 uppercase leading-tight truncate">
                          {tag.nazev}
                        </div>
                        <div className={`text-[7px] font-bold ${colors.text} leading-tight truncate`}>
                          {tag.typ}
                        </div>
                        {tag.stupen && (
                          <span
                            className="inline-block text-white text-[6px] font-bold px-1.5 py-px rounded-full mt-0.5"
                            style={{ backgroundColor: colors.print }}
                          >
                            {tag.stupen}
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="flex justify-between text-[5.5px] text-gray-500 border-t border-gray-200 pt-0.5 mb-0.5">
                          {tag.objem && <span>{tag.objem} ml</span>}
                          {tag.cenaZaLitr && <span>{tag.cenaZaLitr} Kč/l</span>}
                        </div>
                        <div className="text-right leading-none">
                          <span className="text-[16px] font-black text-primary-900">{tag.cenaZbozi}</span>
                          <span className="text-[8px] text-gray-500 ml-0.5">Kč</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
