"use client";

import { useEffect, useMemo, useState } from "react";

import {
  formatImpactCommentBadge,
  IMPACT_CATEGORIES,
  MAX_IMPACT_COMMENT_LENGTH,
} from "@/lib/impact-comments";
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

      const supabaseReload = createSupabaseBrowserClient();
      const { data: refreshed, error: refreshError } = await supabaseReload
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
    <div className="rounded-xl border border-amber-200 bg-amber-50/60">
      <div className="flex items-start gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="min-w-0 flex-1 text-left transition-colors hover:opacity-90"
        >
          <p className="text-sm font-medium text-zinc-900">
            {expanded
              ? report.locations.map((entry) => entry.nama).join(", ")
              : summarizeLocations(report.locations)}
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            {report.unit_pelaksana || "Unit pelaksana belum diisi"} · {waktu}
          </p>
          <p className="mt-1 text-[11px] text-amber-700">
            {expanded ? "Klik untuk ringkas" : "Klik untuk lihat semua lokasi"}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setShowCommentForm((current) => !current)}
          className="relative inline-flex shrink-0 items-center justify-center rounded-lg border border-amber-300 bg-white p-2 text-amber-800 transition-colors hover:bg-amber-100"
          aria-expanded={showCommentForm}
          aria-label="Lapor dampak"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {comments.length > 0 && (
            <span className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-bold text-white">
              {comments.length}
            </span>
          )}
        </button>
      </div>

      {showCommentForm && (
        <form
          onSubmit={(event) => void handleSubmitComment(event)}
          className="border-t border-amber-200 px-4 py-4"
        >
          <label
            htmlFor={`area-${report.id}`}
            className="block text-xs font-medium text-zinc-700"
          >
            Pilih area yang kamu maksud
          </label>
          <select
            id={`area-${report.id}`}
            value={areaValue}
            onChange={(event) => setSelectedArea(event.target.value)}
            disabled={isSubmitting || areaOptions.length === 0}
            className="mt-1.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-amber-500 focus:border-amber-500 focus:ring-2 disabled:cursor-not-allowed disabled:bg-zinc-50"
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

          <p className="mt-4 text-xs font-medium text-zinc-700">
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
                      ? "border-amber-500 bg-amber-500 text-white"
                      : "border-zinc-300 bg-white text-zinc-700 hover:border-amber-300"
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>

          <label
            htmlFor={`comment-${report.id}`}
            className="mt-4 block text-xs font-medium text-zinc-700"
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
            className="mt-1.5 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none ring-amber-500 focus:border-amber-500 focus:ring-2 disabled:cursor-not-allowed disabled:bg-zinc-50"
          />
          <p className="mt-1 text-right text-[11px] text-zinc-500">
            {commentText.length}/{MAX_IMPACT_COMMENT_LENGTH}
          </p>

          <p className="mt-2 text-[11px] text-zinc-500">
            Komentar kamu bisa dipakai buat laporan ke PLN
          </p>

          {formError && (
            <p className="mt-2 text-xs text-red-600" role="alert">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || areaOptions.length === 0}
            className="mt-3 inline-flex items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300"
          >
            {isSubmitting ? "Mengirim..." : "Kirim laporan dampak"}
          </button>
        </form>
      )}

      {(isLoadingComments || comments.length > 0) && (
        <div className="border-t border-amber-200 px-4 py-3">
          {isLoadingComments ? (
            <p className="text-xs text-zinc-500">Memuat komentar...</p>
          ) : (
            <ul className="space-y-3">
              {comments.map((comment) => (
                <li key={comment.id} className="text-sm">
                  <p className="font-mono text-[11px] font-semibold text-amber-800">
                    {formatImpactCommentBadge(
                      comment.nama_area,
                      comment.nomor_komentar,
                    )}
                  </p>
                  <p className="mt-1 text-zinc-800">{comment.komentar}</p>
                  {comment.kategori.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {comment.kategori.map((category) => (
                        <span
                          key={`${comment.id}-${category}`}
                          className="inline-flex rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] text-zinc-600"
                        >
                          {category}
                        </span>
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
