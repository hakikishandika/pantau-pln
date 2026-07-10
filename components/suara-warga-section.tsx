"use client";

import { MessagesSquare } from "lucide-react";
import { useEffect, useState } from "react";

import { CategoryBadge } from "@/components/category-badge";
import { formatImpactCommentBadge } from "@/lib/impact-comments";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { ImpactComment } from "@/lib/types/impact-comment";
import type { ReportSummary } from "@/lib/types/report-summary";

export function SuaraWargaSection() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [comments, setComments] = useState<ImpactComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const supabase = createSupabaseBrowserClient();
        const [summaryResult, commentsResult] = await Promise.all([
          supabase
            .from("report_summaries")
            .select("*")
            .order("generated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("impact_comments")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

        if (!cancelled) {
          setSummary((summaryResult.data as ReportSummary | null) ?? null);
          setComments((commentsResult.data as ImpactComment[]) ?? []);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setSummary(null);
          setComments([]);
          setIsLoading(false);
        }
      }
    }

    void loadData();

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
    <section className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <MessagesSquare className="h-5 w-5 text-blue-500" aria-hidden="true" />
        <h2 className="text-base font-semibold text-gray-50">#SuaraWarga</h2>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-gray-400">Memuat ringkasan...</p>
      ) : !summary ? (
        <p className="mt-4 text-sm text-gray-400">
          Ringkasan akan muncul otomatis setiap hari
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-sm leading-relaxed text-gray-300">
            {summary.summary_text}
          </p>

          {breakdownEntries.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {breakdownEntries.map(([category, count]) => (
                <span
                  key={category}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-700 bg-gray-800 px-3 py-1 text-xs text-gray-300"
                >
                  <CategoryBadge category={category} />
                  <span>{count}</span>
                </span>
              ))}
            </div>
          )}

          <p className="text-sm font-medium text-gray-50">
            Estimasi kerugian terkumpul: Rp{" "}
            {summary.estimated_total_loss_idr.toLocaleString("id-ID")}
          </p>

          <p className="text-[11px] text-gray-500">
            Estimasi berdasarkan laporan warga secara mandiri, bukan angka resmi
            terverifikasi PLN
          </p>
        </div>
      )}

      {comments.length > 0 && (
        <ul className="mt-6 space-y-3 border-t border-gray-800 pt-4">
          {comments.map((comment) => (
            <li key={comment.id}>
              <p className="font-mono text-[11px] font-semibold text-blue-400">
                {formatImpactCommentBadge(
                  comment.nama_area,
                  comment.nomor_komentar,
                )}
              </p>
              <p className="mt-1 text-sm text-gray-300">{comment.komentar}</p>
              {comment.kategori.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {comment.kategori.map((category) => (
                    <CategoryBadge key={`${comment.id}-${category}`} category={category} />
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
