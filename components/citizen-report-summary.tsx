"use client";

import { useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { ReportSummary } from "@/lib/types/report-summary";

export function CitizenReportSummarySection() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      setIsLoading(true);
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("report_summaries")
          .select("*")
          .order("generated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          throw new Error(error.message);
        }

        if (!cancelled) {
          setSummary((data as ReportSummary | null) ?? null);
        }
      } catch {
        if (!cancelled) {
          setSummary(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSummary();

    return () => {
      cancelled = true;
    };
  }, []);

  const breakdownEntries = summary
    ? Object.entries(summary.category_breakdown).filter(
        ([, count]) => Number(count) > 0,
      )
    : [];

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-base font-semibold text-zinc-900">
        Ringkasan Laporan Warga
      </h2>

      {isLoading ? (
        <p className="mt-4 text-sm text-zinc-500">Memuat ringkasan...</p>
      ) : !summary ? (
        <p className="mt-4 text-sm text-zinc-500">
          Ringkasan akan muncul otomatis setiap hari
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-sm leading-relaxed text-zinc-800">
            {summary.summary_text}
          </p>

          {breakdownEntries.length > 0 && (
            <ul className="space-y-1 text-sm text-zinc-700">
              {breakdownEntries.map(([category, count]) => (
                <li key={category}>
                  {category}: {count}
                </li>
              ))}
            </ul>
          )}

          <p className="text-sm font-medium text-zinc-900">
            Estimasi kerugian terkumpul: Rp{" "}
            {summary.estimated_total_loss_idr.toLocaleString("id-ID")}
          </p>

          <p className="text-[11px] text-zinc-500">
            Estimasi berdasarkan laporan warga secara mandiri, bukan angka resmi
            terverifikasi PLN
          </p>
        </div>
      )}
    </section>
  );
}
