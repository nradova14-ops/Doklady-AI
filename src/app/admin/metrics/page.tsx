"use client";

import { useEffect, useState } from "react";

interface Metrics {
  avg_extraction_ms_today: number;
  avg_extraction_ms_week: number;
  extractions_today: number;
  extractions_week: number;
  error_rate_today: number;
  error_rate_week: number;
  tokens_this_month: {
    input: number;
    output: number;
    cache_read: number;
    cache_creation: number;
    total: number;
  };
  cost_usd: number;
  extractions_this_month: number;
  daily_extractions: Array<{ date: string; count: number; errors: number }>;
}

function MetricCard({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

export default function AdminMetricsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/metrics")
      .then((r) => r.json())
      .then(setMetrics)
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

  if (!metrics) {
    return <p className="text-red-600">Nepodařilo se načíst metriky.</p>;
  }

  const maxCount = Math.max(...metrics.daily_extractions.map((d) => d.count), 1);
  const tokens = metrics.tokens_this_month;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Metriky</h1>

      {/* Top metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Extrakce dnes"
          value={String(metrics.extractions_today)}
          subtitle={`Prům. ${(metrics.avg_extraction_ms_today / 1000).toFixed(1)}s`}
        />
        <MetricCard
          label="Extrakce za týden"
          value={String(metrics.extractions_week)}
          subtitle={`Prům. ${(metrics.avg_extraction_ms_week / 1000).toFixed(1)}s`}
        />
        <MetricCard
          label="Chybovost dnes"
          value={`${metrics.error_rate_today}%`}
          subtitle={`Za týden: ${metrics.error_rate_week}%`}
        />
        <MetricCard
          label="Claude API náklady"
          value={`$${metrics.cost_usd.toFixed(2)}`}
          subtitle={`${metrics.extractions_this_month} extrakcí tento měsíc`}
        />
      </div>

      {/* Token usage breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Spotřeba tokenů tento měsíc</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Input tokeny</span>
              <span className="font-medium text-slate-900">{formatTokens(tokens.input)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Output tokeny</span>
              <span className="font-medium text-slate-900">{formatTokens(tokens.output)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Cache read</span>
              <span className="font-medium text-slate-900">{formatTokens(tokens.cache_read)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Cache creation</span>
              <span className="font-medium text-slate-900">{formatTokens(tokens.cache_creation)}</span>
            </div>
            <div className="border-t border-slate-100 pt-2 flex justify-between text-sm font-semibold">
              <span className="text-slate-700">Celkem</span>
              <span className="text-slate-900">{formatTokens(tokens.total)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Rozpad nákladů</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Input ($3/1M)</span>
              <span className="font-medium text-slate-900">
                ${((tokens.input / 1_000_000) * 3).toFixed(3)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Output ($15/1M)</span>
              <span className="font-medium text-slate-900">
                ${((tokens.output / 1_000_000) * 15).toFixed(3)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Cache read ($0.30/1M)</span>
              <span className="font-medium text-slate-900">
                ${((tokens.cache_read / 1_000_000) * 0.3).toFixed(3)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Cache creation ($3.75/1M)</span>
              <span className="font-medium text-slate-900">
                ${((tokens.cache_creation / 1_000_000) * 3.75).toFixed(3)}
              </span>
            </div>
            <div className="border-t border-slate-100 pt-2 flex justify-between text-sm font-semibold">
              <span className="text-slate-700">Celkem</span>
              <span className="text-slate-900">${metrics.cost_usd.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bar chart - daily extractions */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Extrakce za posledních 7 dní</h3>
        <div className="flex items-end gap-2 h-40">
          {metrics.daily_extractions.map((day) => {
            const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
            const errorHeight = maxCount > 0 ? (day.errors / maxCount) * 100 : 0;
            const successHeight = height - errorHeight;
            const dayLabel = new Date(day.date + "T12:00:00").toLocaleDateString("cs-CZ", {
              weekday: "short",
              day: "numeric",
            });

            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-slate-500">{day.count}</span>
                <div className="w-full flex flex-col justify-end" style={{ height: "120px" }}>
                  {day.errors > 0 && (
                    <div
                      className="w-full bg-red-400 rounded-t"
                      style={{ height: `${errorHeight}%`, minHeight: day.errors > 0 ? "2px" : "0" }}
                    />
                  )}
                  <div
                    className={`w-full bg-slate-600 ${day.errors > 0 ? "" : "rounded-t"} rounded-b`}
                    style={{ height: `${successHeight}%`, minHeight: day.count > 0 ? "2px" : "0" }}
                  />
                </div>
                <span className="text-xs text-slate-400">{dayLabel}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-slate-600" /> Úspěšné
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-400" /> Chyby
          </span>
        </div>
      </div>
    </div>
  );
}
