"use client";

import { useEffect, useState } from "react";

interface Metrics {
  avg_extraction_ms_today: number;
  avg_extraction_ms_week: number;
  extractions_today: number;
  extractions_week: number;
  error_rate_today: number;
  error_rate_week: number;
  estimated_tokens_this_month: number;
  estimated_cost_usd: number;
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
          label="Claude API odhad"
          value={`$${metrics.estimated_cost_usd.toFixed(2)}`}
          subtitle={`~${(metrics.estimated_tokens_this_month / 1000).toFixed(0)}k tokenů tento měsíc`}
        />
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
