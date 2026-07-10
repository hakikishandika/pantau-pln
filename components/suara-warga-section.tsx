"use client";

import { MessagesSquare } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { CategoryBadge } from "@/components/category-badge";
import { getCategoryBadgeClass } from "@/lib/category-badge-styles";
import {
  formatImpactCommentBadge,
  IMPACT_CATEGORIES,
  MAX_IMPACT_COMMENT_LENGTH,
} from "@/lib/impact-comments";
import type { TodayFlyerReport } from "@/lib/public-dashboard";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { ImpactComment } from "@/lib/types/impact-comment";
import type { ReportSummary } from "@/lib/types/report-summary";

function getUniqueAreas(report: TodayFlyerReport): string[] {
  return Array.from(new Set(report.locations.map((entry) => entry.nama)));
}

function formatReportLabel(report: TodayFlyerReport): string {
  const waktu =
    report.locations[0]?.jam || report.waktu_pemadaman?.trim() || "—";
  const unit = report.unit_pelaksana || "Unit belum diisi";
  const areaCount = report.locations.length;
  return `${unit} · ${waktu} · ${areaCount} lokasi`;
}

export function SuaraWargaSection({
  todayReports,
}: {
  todayReports: TodayFlyerReport[];
}) {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [comments, setComments] = useState<ImpactComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [selectedFlyerId, setSelectedFlyerId] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const defaultFlyerId = todayReports[0]?.id ?? "";
  const flyerIdValue = selectedFlyerId || defaultFlyerId;

  const selectedReport = useMemo(
    () => todayReports.find((report) => report.id === flyerIdValue) ?? null,
    [todayReports, flyerIdValue],
  );

  const areaOptions = useMemo(
    () => (selectedReport ? getUniqueAreas(selectedReport) : []),
    [selectedReport],
  );

  const areaValue = selectedArea || areaOptions[0] || "";

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

  async function reloadComments() {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("impact_comments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    setComments((data as ImpactComment[]) ?? []);
  }

  function toggleCategory(category: string) {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  }

  async function handleSubmitComment(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!flyerIdValue) {
      setFormError("Pilih laporan pemadaman hari ini.");
      return;
    }

    if (!areaValue) {
      setFormError("Pilih area yang kamu maksud.");
      return;
    }

    if (selectedCategories.length === 0) {
      setFormError("Pilih minimal satu kategori dampak.");
      return;
    }

    const trimmedComment = commentText.trim();
    if (!trimmedComment) {
      setFormError("Tulis cerita dampaknya terlebih dahulu.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();

      const { count, error: countError } = await supabase
        .from("impact_comments")
        .select("*", { count: "exact", head: true })
        .eq("nama_area", areaValue);

      if (countError) {
        throw new Error(countError.message);
      }

      const nomorKomentar = (count ?? 0) + 1;

      const { error: insertError } = await supabase
        .from("impact_comments")
        .insert({
          flyer_id: flyerIdValue,
          nama_area: areaValue,
          kategori: selectedCategories,
          komentar: trimmedComment,
          nomor_komentar: nomorKomentar,
        });

      if (insertError) {
        throw new Error(insertError.message);
      }

      setCommentText("");
      setSelectedCategories([]);
      setShowCommentForm(false);
      await reloadComments();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Gagal mengirim laporan dampak.";
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const breakdownEntries = summary
    ? Object.entries(summary.category_breakdown).filter(
        ([, count]) => Number(count) > 0,
      )
    : [];

  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessagesSquare className="h-5 w-5 text-blue-500" aria-hidden="true" />
          <h2 className="text-base font-semibold text-gray-50">#SuaraWarga</h2>
        </div>
        <button
          type="button"
          onClick={() => setShowCommentForm((current) => !current)}
          disabled={todayReports.length === 0}
          className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-800"
        >
          Tulis laporan dampak
        </button>
      </div>

      {showCommentForm && (
        <form
          onSubmit={(event) => void handleSubmitComment(event)}
          className="mt-4 rounded-xl border border-gray-700 bg-gray-800/50 p-4"
        >
          {todayReports.length === 0 ? (
            <p className="text-sm text-gray-400">
              Belum ada laporan pemadaman hari ini untuk dikomentari.
            </p>
          ) : (
            <>
              <label
                htmlFor="suara-flyer"
                className="block text-xs font-medium text-gray-400"
              >
                Pilih laporan hari ini
              </label>
              <select
                id="suara-flyer"
                value={flyerIdValue}
                onChange={(event) => {
                  setSelectedFlyerId(event.target.value);
                  setSelectedArea("");
                }}
                disabled={isSubmitting}
                className="mt-1.5 block w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-50 outline-none ring-blue-500 focus:border-blue-500 focus:ring-2"
              >
                {todayReports.map((report) => (
                  <option key={report.id} value={report.id}>
                    {formatReportLabel(report)}
                  </option>
                ))}
              </select>

              <label
                htmlFor="suara-area"
                className="mt-4 block text-xs font-medium text-gray-400"
              >
                Pilih area yang kamu maksud
              </label>
              <select
                id="suara-area"
                value={areaValue}
                onChange={(event) => setSelectedArea(event.target.value)}
                disabled={isSubmitting || areaOptions.length === 0}
                className="mt-1.5 block w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-50 outline-none ring-blue-500 focus:border-blue-500 focus:ring-2"
              >
                {areaOptions.length === 0 ? (
                  <option value="">Tidak ada area</option>
                ) : (
                  areaOptions.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))
                )}
              </select>

              <p className="mt-4 text-xs font-medium text-gray-400">
                Kategori dampak (bisa pilih lebih dari satu)
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {IMPACT_CATEGORIES.map((category) => {
                  const isActive = selectedCategories.includes(category);
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => toggleCategory(category)}
                      disabled={isSubmitting}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        isActive
                          ? `${getCategoryBadgeClass(category)} border-transparent`
                          : "border-gray-600 bg-gray-800 text-gray-400 hover:border-gray-500"
                      }`}
                    >
                      {category}
                    </button>
                  );
                })}
              </div>

              <label
                htmlFor="suara-komentar"
                className="mt-4 block text-xs font-medium text-gray-400"
              >
                Cerita dampakmu
              </label>
              <textarea
                id="suara-komentar"
                value={commentText}
                onChange={(event) =>
                  setCommentText(
                    event.target.value.slice(0, MAX_IMPACT_COMMENT_LENGTH),
                  )
                }
                disabled={isSubmitting}
                rows={3}
                placeholder="Ceritakan dampaknya buat kamu, misalnya: warung saya tutup 5 jam, kerugian sekitar 200 ribu"
                className="mt-1.5 block w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-50 outline-none ring-blue-500 focus:border-blue-500 focus:ring-2"
              />
              <p className="mt-1 text-right text-[11px] text-gray-500">
                {commentText.length}/{MAX_IMPACT_COMMENT_LENGTH}
              </p>

              <p className="mt-2 text-[11px] text-gray-500">
                Komentar kamu bisa dipakai buat laporan ke PLN
              </p>

              {formError && (
                <p className="mt-2 text-xs text-red-400" role="alert">
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting || areaOptions.length === 0}
                className="mt-3 inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-800"
              >
                {isSubmitting ? "Mengirim..." : "Kirim laporan dampak"}
              </button>
            </>
          )}
        </form>
      )}

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
                    <CategoryBadge
                      key={`${comment.id}-${category}`}
                      category={category}
                    />
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
