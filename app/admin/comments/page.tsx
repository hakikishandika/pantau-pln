"use client";

import Link from "next/link";
import { MessageCircle, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { CategoryBadge } from "@/components/category-badge";
import { formatImpactCommentBadge } from "@/lib/impact-comments";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { ImpactCommentWithFlyer } from "@/lib/types/impact-comment";
import type { ReportSummary } from "@/lib/types/report-summary";

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<ImpactCommentWithFlyer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [latestSummary, setLatestSummary] = useState<ReportSummary | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const supabase = createSupabaseBrowserClient();

        const [commentsResult, summaryResult] = await Promise.all([
          supabase
            .from("impact_comments")
            .select(
              `
              *,
              flyers (
                tanggal_pemadaman,
                unit_pelaksana
              )
            `,
            )
            .order("created_at", { ascending: false }),
          supabase
            .from("report_summaries")
            .select("*")
            .order("generated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (commentsResult.error) {
          throw new Error(commentsResult.error.message);
        }

        if (!cancelled) {
          setComments((commentsResult.data as ImpactCommentWithFlyer[]) ?? []);
          setLatestSummary((summaryResult.data as ReportSummary | null) ?? null);
          setIsLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : "Gagal memuat komentar dampak.";
          setErrorMessage(message);
          setIsLoading(false);
        }
      }
    }

    void fetchData();

    return () => {
      cancelled = true;
    };
  }, []);

  async function reloadLatestSummary() {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("report_summaries")
      .select("*")
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setLatestSummary((data as ReportSummary | null) ?? null);
  }

  async function handleDelete(commentId: string) {
    const confirmed = window.confirm("Hapus komentar ini?");
    if (!confirmed) {
      return;
    }

    setDeletingId(commentId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("impact_comments")
        .delete()
        .eq("id", commentId);

      if (error) {
        throw new Error(error.message);
      }

      setComments((current) =>
        current.filter((comment) => comment.id !== commentId),
      );
      setSuccessMessage("Komentar berhasil dihapus.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal menghapus komentar.";
      setErrorMessage(message);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleGenerateSummary() {
    setIsGenerating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/cron/generate-summary", {
        method: "POST",
      });
      const payload = (await response.json()) as {
        status?: string;
        message?: string;
        summary?: ReportSummary;
        processed_count?: number;
      };

      if (!response.ok) {
        throw new Error(payload.message ?? "Gagal membuat ringkasan.");
      }

      if (payload.summary) {
        setLatestSummary(payload.summary);
      } else {
        await reloadLatestSummary();
      }

      setSuccessMessage(
        `Ringkasan dibuat (${payload.processed_count ?? 0} komentar diproses).`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Gagal membuat ringkasan.";
      setErrorMessage(message);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-blue-500" aria-hidden="true" />
            <div>
              <h1 className="text-lg font-bold text-gray-50 sm:text-xl">
                Moderasi Komentar Dampak
              </h1>
              <p className="text-sm text-gray-400">
                Kelola laporan dampak dari warga
              </p>
            </div>
          </div>
          <Link
            href="/admin"
            className="inline-flex w-fit rounded-xl border border-gray-700 px-3 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-800"
          >
            Kembali ke Dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        {errorMessage && (
          <div
            className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400"
            role="status"
          >
            {successMessage}
          </div>
        )}

        <section className="mb-6 rounded-2xl border border-gray-800 bg-gray-900 p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-50">
                Ringkasan Harian
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                {latestSummary
                  ? `Terakhir dibuat: ${new Date(latestSummary.generated_at).toLocaleString("id-ID")}`
                  : "Belum ada ringkasan tersimpan"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleGenerateSummary()}
              disabled={isGenerating}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-800"
            >
              {isGenerating ? (
                <>
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                    aria-hidden="true"
                  />
                  Membuat ringkasan...
                </>
              ) : (
                "Generate Ringkasan Sekarang"
              )}
            </button>
          </div>
        </section>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-500">
            Memuat komentar...
          </div>
        ) : comments.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center text-sm text-gray-500">
            Belum ada komentar dampak.
          </div>
        ) : (
          <ul className="space-y-3">
            {comments.map((comment) => (
              <li
                key={comment.id}
                className="rounded-2xl border border-gray-800 bg-gray-900 p-4 shadow-sm sm:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-semibold text-blue-400">
                      {formatImpactCommentBadge(
                        comment.nama_area,
                        comment.nomor_komentar,
                      )}
                    </p>
                    <p className="mt-2 text-sm text-gray-300">
                      {comment.komentar}
                    </p>
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
                    <p className="mt-2 text-xs text-gray-500">
                      Flyer:{" "}
                      {comment.flyers?.tanggal_pemadaman ?? "tanggal belum diisi"}
                      {comment.flyers?.unit_pelaksana
                        ? ` · ${comment.flyers.unit_pelaksana}`
                        : ""}
                      {" · "}
                      {new Date(comment.created_at).toLocaleString("id-ID")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(comment.id)}
                    disabled={deletingId === comment.id}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    {deletingId === comment.id ? "Menghapus..." : "Hapus"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
