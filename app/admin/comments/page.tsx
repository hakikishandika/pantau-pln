"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
    <main className="flex flex-1 flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-bold text-zinc-900 sm:text-xl">
              Moderasi Komentar Dampak
            </h1>
            <p className="text-sm text-zinc-600">
              Kelola laporan dampak dari warga
            </p>
          </div>
          <Link
            href="/admin"
            className="inline-flex w-fit rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Kembali ke Dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        {errorMessage && (
          <div
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
            role="status"
          >
            {successMessage}
          </div>
        )}

        <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">
                Ringkasan Harian
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                {latestSummary
                  ? `Terakhir dibuat: ${new Date(latestSummary.generated_at).toLocaleString("id-ID")}`
                  : "Belum ada ringkasan tersimpan"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleGenerateSummary()}
              disabled={isGenerating}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-300"
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
          <div className="flex items-center justify-center py-16 text-sm text-zinc-500">
            Memuat komentar...
          </div>
        ) : comments.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
            Belum ada komentar dampak.
          </div>
        ) : (
          <ul className="space-y-3">
            {comments.map((comment) => (
              <li
                key={comment.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-semibold text-amber-800">
                      {formatImpactCommentBadge(
                        comment.nama_area,
                        comment.nomor_komentar,
                      )}
                    </p>
                    <p className="mt-2 text-sm text-zinc-800">
                      {comment.komentar}
                    </p>
                    {comment.kategori.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {comment.kategori.map((category) => (
                          <span
                            key={`${comment.id}-${category}`}
                            className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] text-zinc-600"
                          >
                            {category}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 text-xs text-zinc-500">
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
                    className="inline-flex shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
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
