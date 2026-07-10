"use client";

import { MessageCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { CategoryBadge } from "@/components/category-badge";
import {
  formatImpactCommentBadge,
  IMPACT_CATEGORIES,
  MAX_IMPACT_COMMENT_LENGTH,
} from "@/lib/impact-comments";
import { getCategoryBadgeClass } from "@/lib/category-badge-styles";
import type { TodayFlyerReport } from "@/lib/public-dashboard";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { ImpactComment } from "@/lib/types/impact-comment";

function summarizeLocations(locations: TodayFlyerReport["locations"]): string {
  const names = locations.map((entry) => entry.nama);
  if (names.length === 0) {
    return "Lokasi belum tersedia";
  }
  if (names.length <= 3) {
    return names.join(", ");
  }
  return `${names.slice(0, 3).join(", ")} +${names.length - 3} lokasi lain`;
}

function getUniqueAreas(report: TodayFlyerReport): string[] {
  return Array.from(new Set(report.locations.map((entry) => entry.nama)));
}

export function TodayOutageReportRow({ report }: { report: TodayFlyerReport }) {
  const [expanded, setExpanded] = useState(false);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [comments, setComments] = useState<ImpactComment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const areaOptions = useMemo(() => getUniqueAreas(report), [report]);
  const areaValue = selectedArea || areaOptions[0] || "";
  const waktu =
    report.locations[0]?.jam || report.waktu_pemadaman?.trim() || "—";

  useEffect(() => {
    let cancelled = false;

    async function fetchComments() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("impact_comments")
          .select("*")
          .eq("flyer_id", report.id)
          .order("created_at", { ascending: false });

        if (error) {
          throw new Error(error.message);
        }

        if (!cancelled) {
          setComments((data as ImpactComment[]) ?? []);
          setIsLoadingComments(false);
        }
      } catch {
        if (!cancelled) {
          setComments([]);
          setIsLoadingComments(false);
        }
      }
    }

    void fetchComments();

    return () => {
      cancelled = true;
    };
  }, [report.id]);

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
          flyer_id: report.id,
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
      setSelectedArea("");

      const { data: refreshed, error: refreshError } = await supabase
        .from("impact_comments")
        .select("*")
        .eq("flyer_id", report.id)
        .order("created_at", { ascending: false });

      if (!refreshError) {
        setComments((refreshed as ImpactComment[]) ?? []);
      }
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

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/60">
      <div className="flex items-start gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="min-w-0 flex-1 text-left transition-colors hover:opacity-90"
        >
          <p className="text-sm font-medium text-gray-50">
            {expanded
              ? report.locations.map((entry) => entry.nama).join(", ")
              : summarizeLocations(report.locations)}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {report.unit_pelaksana || "Unit pelaksana belum diisi"} · {waktu}
          </p>
          <p className="mt-1 text-[11px] text-blue-400">
            {expanded ? "Klik untuk ringkas" : "Klik untuk lihat semua lokasi"}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setShowCommentForm((current) => !current)}
          className="relative inline-flex shrink-0 items-center justify-center rounded-xl border border-gray-600 bg-gray-800 p-2 text-blue-400 transition-colors hover:bg-gray-700"
          aria-expanded={showCommentForm}
          aria-label="Lapor dampak"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          {comments.length > 0 && (
            <span className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
              {comments.length}
            </span>
          )}
        </button>
      </div>

      {showCommentForm && (
        <form
          onSubmit={(event) => void handleSubmitComment(event)}
          className="border-t border-gray-700 px-4 py-4"
        >
          <label
            htmlFor={`area-${report.id}`}
            className="block text-xs font-medium text-gray-400"
          >
            Pilih area yang kamu maksud
          </label>
          <select
            id={`area-${report.id}`}
            value={areaValue}
            onChange={(event) => setSelectedArea(event.target.value)}
            disabled={isSubmitting || areaOptions.length === 0}
            className="mt-1.5 block w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-50 outline-none ring-blue-500 focus:border-blue-500 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
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
            htmlFor={`comment-${report.id}`}
            className="mt-4 block text-xs font-medium text-gray-400"
          >
            Cerita dampakmu
          </label>
          <textarea
            id={`comment-${report.id}`}
            value={commentText}
            onChange={(event) =>
              setCommentText(event.target.value.slice(0, MAX_IMPACT_COMMENT_LENGTH))
            }
            disabled={isSubmitting}
            rows={3}
            placeholder="Ceritakan dampaknya buat kamu, misalnya: warung saya tutup 5 jam, kerugian sekitar 200 ribu"
            className="mt-1.5 block w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-50 outline-none ring-blue-500 focus:border-blue-500 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
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
        </form>
      )}

      {(isLoadingComments || comments.length > 0) && (
        <div className="border-t border-gray-700 px-4 py-3">
          {isLoadingComments ? (
            <p className="text-xs text-gray-500">Memuat komentar...</p>
          ) : (
            <ul className="space-y-3">
              {comments.map((comment) => (
                <li key={comment.id} className="text-sm">
                  <p className="font-mono text-[11px] font-semibold text-blue-400">
                    {formatImpactCommentBadge(
                      comment.nama_area,
                      comment.nomor_komentar,
                    )}
                  </p>
                  <p className="mt-1 text-gray-300">{comment.komentar}</p>
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
        </div>
      )}
    </div>
  );
}
