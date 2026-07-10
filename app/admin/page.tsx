"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { formatSubmitDate, StatusBadge } from "@/lib/admin-ui";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { Flyer, FlyerFilter } from "@/lib/types/flyer";

const FILTERS: { value: FlyerFilter; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [filter, setFilter] = useState<FlyerFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoApprove, setAutoApprove] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    let cancelled = false;

    async function loadFlyers() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("flyers")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          throw new Error(error.message);
        }

        if (!cancelled) {
          setFlyers((data as Flyer[]) ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : "Gagal memuat data flyer.";
          setErrorMessage(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadFlyers();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      setIsLoadingSettings(true);
      try {
        const response = await fetch("/api/settings");
        const payload = (await response.json()) as {
          auto_approve?: boolean;
          message?: string;
        };
        if (!response.ok) {
          throw new Error(payload.message ?? "Gagal memuat pengaturan.");
        }
        if (!cancelled) {
          setAutoApprove(Boolean(payload.auto_approve));
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : "Gagal memuat pengaturan.";
          setErrorMessage(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSettings(false);
        }
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredFlyers =
    filter === "all"
      ? flyers
      : flyers.filter((flyer) => flyer.status === filter);

  const unprocessedFlyers = flyers.filter(
    (flyer) => flyer.raw_ai_response === null,
  );

  async function handleToggleAutoApprove() {
    const nextValue = !autoApprove;
    setIsSavingSettings(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_approve: nextValue }),
      });
      const payload = (await response.json()) as {
        auto_approve?: boolean;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message ?? "Gagal menyimpan pengaturan.");
      }

      setAutoApprove(Boolean(payload.auto_approve));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Gagal menyimpan pengaturan.";
      setErrorMessage(message);
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function handleBulkProcess() {
    if (unprocessedFlyers.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      `Proses ${unprocessedFlyers.length} flyer yang belum diproses? Proses ini bisa memakan waktu lama.`,
    );
    if (!confirmed) {
      return;
    }

    setIsBulkProcessing(true);
    setErrorMessage(null);
    setBulkProgress({ current: 0, total: unprocessedFlyers.length });

    try {
      for (let index = 0; index < unprocessedFlyers.length; index += 1) {
        const flyer = unprocessedFlyers[index];
        setBulkProgress({
          current: index + 1,
          total: unprocessedFlyers.length,
        });

        await fetch("/api/process-flyer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ flyerId: flyer.id }),
        });
      }

      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("flyers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      setFlyers((data as Flyer[]) ?? []);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Gagal memproses flyer secara massal.";
      setErrorMessage(message);
    } finally {
      setIsBulkProcessing(false);
      setBulkProgress({ current: 0, total: 0 });
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    setErrorMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw new Error(error.message);
      }

      router.push("/admin/login");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal logout.";
      setErrorMessage(message);
      setIsLoggingOut(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-zinc-900 sm:text-xl">
              Dashboard Admin
            </h1>
            <p className="text-sm text-zinc-600">
              Kelola submission flyer pemadaman
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/regeocode"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Regeocode Data
            </Link>
            <Link
              href="/admin/comments"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Komentar Dampak
            </Link>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoggingOut ? "Keluar..." : "Logout"}
            </button>
          </div>
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

        <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">
                Auto-Approve Flyer Baru
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Jika aktif, flyer yang berhasil diproses otomatis tayang tanpa
                review manual.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleToggleAutoApprove()}
              disabled={isLoadingSettings || isSavingSettings || isBulkProcessing}
              aria-pressed={autoApprove}
              className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                autoApprove ? "bg-green-600" : "bg-zinc-300"
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                  autoApprove ? "translate-x-7" : "translate-x-1"
                }`}
              />
              <span className="sr-only">
                {autoApprove ? "Auto-approve aktif" : "Auto-approve nonaktif"}
              </span>
            </button>
          </div>

          <div className="mt-4 border-t border-zinc-100 pt-4">
            <button
              type="button"
              onClick={() => void handleBulkProcess()}
              disabled={
                isBulkProcessing ||
                isLoading ||
                unprocessedFlyers.length === 0
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-300"
            >
              {isBulkProcessing ? (
                <>
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                    aria-hidden="true"
                  />
                  Memproses {bulkProgress.current}/{bulkProgress.total}
                </>
              ) : (
                "Proses Semua yang Belum Diproses"
              )}
            </button>
            <p className="mt-2 text-xs text-zinc-500">
              {unprocessedFlyers.length > 0
                ? `${unprocessedFlyers.length} flyer belum diekstrak (raw_ai_response kosong).`
                : "Semua flyer sudah pernah diproses."}
            </p>
          </div>
        </section>

        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === item.value
                  ? "bg-blue-600 text-white"
                  : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-zinc-500">
            <span
              className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600"
              aria-hidden="true"
            />
            Memuat flyer...
          </div>
        ) : filteredFlyers.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
            Tidak ada flyer untuk filter ini.
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {filteredFlyers.map((flyer) => (
              <li key={flyer.id}>
                <Link
                  href={`/admin/${flyer.id}`}
                  className="flex gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md sm:p-4"
                >
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 sm:h-24 sm:w-24">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={flyer.image_url}
                      alt="Thumbnail flyer"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-medium text-zinc-900">
                        {flyer.unit_pelaksana || "Belum ada unit"}
                      </p>
                      <StatusBadge status={flyer.status} />
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      {flyer.tanggal_pemadaman
                        ? `Tanggal: ${flyer.tanggal_pemadaman}`
                        : "Tanggal belum diisi"}
                    </p>
                    <p className="mt-2 text-xs text-zinc-400">
                      Submit: {formatSubmitDate(flyer.created_at)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
